/**
 * The scan — one activity row in, one verdict out.
 *
 * The person this is for: someone whose product has a stream of user activity
 * (chat messages, saved documents, spreadsheet cells) and who wants the system
 * to notice "that looked important" without acting on its own. A message
 * mentioning a company the team met last week should surface as a suggestion
 * in an inbox. It must not start a research job, send an email, or spend money.
 *
 * So this function only ever writes a status onto the row it was given. The
 * doctrine, in the repo's words: **notice passively, act explicitly.** Turning
 * a "noteworthy" row into an action is the caller's decision, always.
 *
 * Every early return below is a reason a suggestion was withheld, and every one
 * of them is written onto the row so a human can ask "why did nothing happen?"
 * and get an answer.
 */

import { classifyNoteworthy, type NoteworthyFinding } from "./classifier.js";
import {
  resolveAssistivePolicy,
  isSignalDisabled,
  isEntityWatchlisted,
  type AssistivePolicy,
} from "./policyResolver.js";
import type { MemoryStore, ActivityStatus, NoteworthyRow } from "./ports.js";

/** What the scan decided, and why. */
export interface ScanResult {
  status: ActivityStatus;
  finding?: NoteworthyFinding;
  reason?: string;
  text?: string;
}

/** One activity row on its way in. */
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

export interface ScanConfig {
  /** Ceiling on suggestions per room per hour. Default 10. */
  maxPerRoomPerHour?: number;
  /** Override the built-in system default policy. */
  systemDefaultPolicy?: Partial<AssistivePolicy>;
}

/** A suggestion older than two days no longer blocks a fresh one for the same entity. */
const FEED_STALENESS_MS = 2 * 24 * 60 * 60 * 1000;

const DEFAULT_MAX_PER_ROOM_PER_HOUR = 10;

/**
 * Does this room already have an open suggestion about any of these entities?
 *
 * Without this, one company mentioned in six messages becomes six identical
 * inbox items and the user stops reading the inbox.
 */
export async function findExistingNoteworthyForEntity(
  store: Pick<MemoryStore, "listNoteworthy">,
  roomId: string,
  entityNames: string[],
  excludeId?: string,
): Promise<boolean> {
  if (!entityNames.length) return false;
  const rows: NoteworthyRow[] = await store.listNoteworthy(roomId, 50);
  const cutoff = Date.now() - FEED_STALENESS_MS;
  const wanted = new Set(entityNames.map((e) => e.toLowerCase().trim()).filter(Boolean));
  return rows.some(
    (row) =>
      row.id !== excludeId &&
      row.updatedAt >= cutoff &&
      row.entityNames.some((e) => wanted.has(e.toLowerCase().trim())),
  );
}

/**
 * Scan one activity row and decide its fate.
 *
 * The gates, in order — the first one that trips wins, and its name becomes the
 * row's `reason`:
 *
 * 1. `not_noteworthy` — the text scored below the bar.
 * 2. `policy_off`     — the room turned passive intelligence off.
 * 3. `signal_disabled_by_policy` — the room muted this kind of signal.
 * 4. `not_on_watchlist` — the room only wants pre-approved entities.
 * 5. `room_quota_exceeded` — too many suggestions this hour already.
 * 6. `duplicate_entity` — an open suggestion for this entity exists.
 * 7. `previously_dismissed` — a human already said no to this entity.
 *
 * Survive all seven and the row becomes `noteworthy`: a suggestion waiting for
 * a person, not a job that has started.
 */
export async function scanActivity(
  store: MemoryStore,
  input: ScanInput,
  config?: ScanConfig,
): Promise<ScanResult> {
  const maxPerRoomPerHour = config?.maxPerRoomPerHour ?? DEFAULT_MAX_PER_ROOM_PER_HOUR;
  const { text } = input;
  const finding = classifyNoteworthy(text);

  /** Write the verdict onto the row and hand the same verdict back to the caller. */
  const settle = async (status: ActivityStatus, reason?: string): Promise<ScanResult> => {
    await store.patchRow(input.id, { status, finding, reason, updatedAt: Date.now() });
    return { status, finding, reason, text };
  };

  if (finding.action === "ignore") return settle("not_noteworthy");

  const entityNames = finding.entities.map((e) => e.displayName).filter(Boolean);

  const policy = await resolveAssistivePolicy(store, input.roomId, config?.systemDefaultPolicy);
  if (policy.mode === "off") return settle("not_noteworthy", "policy_off");
  if (isSignalDisabled(policy.disabledSignalKinds, finding.signals)) {
    return settle("not_noteworthy", "signal_disabled_by_policy");
  }
  if (
    policy.mode === "approved_watchlist_only" &&
    !isEntityWatchlisted(policy.approvedEntityWatchlist, entityNames)
  ) {
    return settle("not_noteworthy", "not_on_watchlist");
  }

  if ((await store.countNoteworthyLastHour(input.roomId)) >= maxPerRoomPerHour) {
    return settle("not_noteworthy", "room_quota_exceeded");
  }
  if (await findExistingNoteworthyForEntity(store, input.roomId, entityNames, input.id)) {
    return settle("not_noteworthy", "duplicate_entity");
  }
  if (entityNames.length && (await store.isEntityDismissed(input.roomId, entityNames))) {
    return settle("not_noteworthy", "previously_dismissed");
  }

  return settle("noteworthy");
}
