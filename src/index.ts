/**
 * NodeMem — passive memory for agent systems.
 *
 * It watches a stream of activity, notices entities worth a second look, and
 * puts them in front of a person as suggestions. It never starts work on its
 * own. The core is plain TypeScript with no provider dependency; storage is the
 * `MemoryStore` interface in `core/ports.ts`, which any database can satisfy.
 *
 * Start reading at `core/scanOrchestrator.ts` — every gate in the pipeline is
 * one early return in `scanActivity`.
 */

// The pipeline: one activity row in, one verdict out.
export { scanActivity, findExistingNoteworthyForEntity, type ScanInput, type ScanResult } from "./core/scanOrchestrator.js";

// Does this text deserve a person's attention?
export { classifyNoteworthy, normalizeEntityKey, type NoteworthyFinding, type Signal, SIGNAL, SIGNAL_ORDER, CLASSIFIER_VERSION } from "./core/classifier.js";

// How much noticing this room allows.
export { resolveAssistivePolicy, isSignalDisabled, isEntityWatchlisted, type AssistiveMode, type AssistivePolicy } from "./core/policyResolver.js";

// Coalescing a burst of typing into a single scan.
export { activityDedupeKey, type ActivityEvent, type ActivityDedupeArgs } from "./core/dedupeKey.js";
export { computeDebounce } from "./core/debouncer.js";

// What your backend must implement, and the reference implementation of it.
export type { MemoryStore, DedupStore, DismissalStore, PolicyStore, NoteworthyRow, DismissalEntry, ActivityStatus } from "./core/ports.js";
export { InMemoryAdapter } from "./adapters/inMemoryAdapter.js";
