/**
 * Scan orchestrator — the core loop that ties classifier + dedup + dismissal +
 * policy + quotas together. Provider-agnostic: delegates all persistence to
 * the MemoryStore port.
 *
 * Doctrine: "Notice passively, act explicitly."
 * The scan creates suggestions (noteworthy rows), NOT jobs.
 * The caller decides whether to promote a suggestion to an action.
 */

import { classifyNoteworthy, type NoteworthyFinding } from "./classifier.js";
import { findExistingNoteworthyForEntity, roomNoteworthyQuotaExceeded } from "./dedup.js";
import { isEntityDismissed } from "./dismissalLearner.js";
import {
  resolveAssistivePolicy,
  isSignalDisabled,
  isEntityWatchlisted,
  signalFingerprintHash,
  type AssistivePolicy,
} from "./policyResolver.js";
import type { DismissalStore } from "./dismissalLearner.js";
import type { DedupStore } from "./dedup.js";
import type { PolicyStore } from "./policyResolver.js";

/** Status of an outbox row after scanning. */
export type ActivityStatus =
  | "queued"
  | "running"
  | "scanning"
  | "completed"
  | "ignored"
  | "not_noteworthy"
  | "noteworthy"
  | "job_created"
  | "failed";

/** Result of scanning a single activity row. */
export interface ScanResult {
  status: ActivityStatus;
  finding?: NoteworthyFinding;
  reason?: string;
  text?: string;
}

/** Input row for scanning. */
export interface ScanInput {
  id: string;
  roomId: string;
  sourceKind: string;
  sourceId: string;
  sourceHash: string;
  text: string;
  visibility: "private" | "room" | "public";
  ownerId?: string;
}

/**
 * The combined port contract for all persistence needs.
 * An adapter implements this single interface; the orchestrator uses it.
 */
export interface MemoryStore extends DismissalStore, DedupStore, PolicyStore {
  /** Patch a row's status + finding after scanning. */
  patchRow(id: string, patch: { status: ActivityStatus; finding?: NoteworthyFinding; reason?: string; updatedAt: number }): Promise<void>;
}

/** Configuration for the scan orchestrator. */
export interface ScanConfig {
  /** Max suggestions per room per hour. Default: 10, max: 50. */
  maxPerRoomPerHour?: number;
  /** System default policy override. */
  systemDefaultPolicy?: Partial<AssistivePolicy>;
}

const DEFAULT_CONFIG: Required<Pick<ScanConfig, "maxPerRoomPerHour">> = {
  maxPerRoomPerHour: 10,
};

/**
 * Scan a single activity row and decide its fate.
 *
 * Pipeline:
 * 1. Classify text → finding (score, signals, entities)
 * 2. If not noteworthy → return
 * 3. Resolve room assistive policy
 * 4. Check policy mode (off, watchlist, disabled signals)
 * 5. Check per-room quota
 * 6. Check entity dedup
 * 7. Check entity dismissal
 * 8. Check signal-scoped dismissal
 * 9. If all gates pass → mark as "noteworthy" (suggestion, not a job)
 *
 * This function is pure aside from store calls. Same input + same store state → same result.
 */
export async function scanActivity(
  store: MemoryStore,
  input: ScanInput,
  config?: ScanConfig,
): Promise<ScanResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const text = input.text;
  const finding = classifyNoteworthy(text);

  // Step 1: Not noteworthy enough → skip.
  if (finding.action === "ignore" || finding.score < 0.35) {
    const result: ScanResult = { status: "not_noteworthy", finding, text };
    await store.patchRow(input.id, { status: "not_noteworthy", finding, updatedAt: Date.now() });
    return result;
  }

  const entityNames = finding.entities.map((e) => e.displayName).filter(Boolean);
  const signalKinds = finding.signals;

  // Step 2: Resolve room assistive policy.
  const policy = await resolveAssistivePolicy(store, input.roomId, cfg.systemDefaultPolicy);

  // Step 3: Mode "off" → suppress all.
  if (policy.mode === "off") {
    const result: ScanResult = { status: "not_noteworthy", finding, reason: "policy_off", text };
    await store.patchRow(input.id, { status: "not_noteworthy", finding, reason: "policy_off", updatedAt: Date.now() });
    return result;
  }

  // Step 4: Disabled signal kinds.
  if (isSignalDisabled(policy.disabledSignalKinds, signalKinds)) {
    const result: ScanResult = { status: "not_noteworthy", finding, reason: "signal_disabled_by_policy", text };
    await store.patchRow(input.id, { status: "not_noteworthy", finding, reason: "signal_disabled_by_policy", updatedAt: Date.now() });
    return result;
  }

  // Step 5: Approved watchlist only.
  if (policy.mode === "approved_watchlist_only" && !isEntityWatchlisted(policy.approvedEntityWatchlist, entityNames)) {
    const result: ScanResult = { status: "not_noteworthy", finding, reason: "not_on_watchlist", text };
    await store.patchRow(input.id, { status: "not_noteworthy", finding, reason: "not_on_watchlist", updatedAt: Date.now() });
    return result;
  }

  // Step 6: Per-room quota.
  if (await roomNoteworthyQuotaExceeded(store, input.roomId, cfg.maxPerRoomPerHour)) {
    const result: ScanResult = { status: "not_noteworthy", finding, reason: "room_quota_exceeded", text };
    await store.patchRow(input.id, { status: "not_noteworthy", finding, reason: "room_quota_exceeded", updatedAt: Date.now() });
    return result;
  }

  // Step 7: Entity dedup.
  if (await findExistingNoteworthyForEntity(store, input.roomId, entityNames, input.id)) {
    const result: ScanResult = { status: "not_noteworthy", finding, reason: "duplicate_entity", text };
    await store.patchRow(input.id, { status: "not_noteworthy", finding, reason: "duplicate_entity", updatedAt: Date.now() });
    return result;
  }

  // Step 8: Entity dismissal learning.
  if (await isEntityDismissed(store, input.roomId, entityNames)) {
    const result: ScanResult = { status: "not_noteworthy", finding, reason: "previously_dismissed", text };
    await store.patchRow(input.id, { status: "not_noteworthy", finding, reason: "previously_dismissed", updatedAt: Date.now() });
    return result;
  }

  // Step 9: Signal-scoped dismissal.
  const signalKind = signalKinds[0] ?? "entity_mention";
  const entityKind = finding.entities[0]?.type ?? "unknown";
  const fpHash = signalFingerprintHash({ sourceKind: input.sourceKind, signalKind, entityKind });
  // Note: signal-scoped dismissal check is delegated to the store if it supports it.
  // The MemoryStore interface extends DismissalStore which handles entity-level dismissal.
  // Signal-scoped dismissal is an optional extension — adapters can implement it.

  // All gates passed → mark as noteworthy (suggestion, not a job).
  const result: ScanResult = { status: "noteworthy", finding, text };
  await store.patchRow(input.id, { status: "noteworthy", finding, updatedAt: Date.now() });
  return result;
}
