/**
 * NodeMem — Provider-agnostic passive memory for agent systems.
 *
 * The core is pure TypeScript with no provider dependency:
 * - classifyNoteworthy: deterministic entity + signal detection from text
 * - dedup + dismissal learning + per-room quotas + assistive policy resolution
 *
 * Adapters (Convex, SQLite, in-memory) implement the port contracts.
 */

export { classifyNoteworthy, normalizeEntityKey, type NoteworthyFinding, type Signal, SIGNAL, SIGNAL_ORDER, CLASSIFIER_VERSION } from "./core/classifier.js";
export { isEntityDismissed, type DismissalEntry, type DismissalStore } from "./core/dismissalLearner.js";
export { findExistingNoteworthyForEntity, roomNoteworthyQuotaExceeded, type NoteworthyRow, type DedupStore } from "./core/dedup.js";
export { resolveAssistivePolicy, isSignalDisabled, isEntityWatchlisted, signalFingerprintHash, type AssistiveMode, type AssistivePolicy, type PolicyStore } from "./core/policyResolver.js";
export { activityDedupeKey, type ActivityEvent, type ActivityDedupeArgs } from "./core/dedupeKey.js";
export { scanActivity, type ScanInput, type ScanResult, type MemoryStore } from "./core/scanOrchestrator.js";
export { InMemoryAdapter } from "./adapters/inMemoryAdapter.js";
