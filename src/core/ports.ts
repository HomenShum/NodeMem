/**
 * The whole storage contract, in one file.
 *
 * The person this is for: an engineer wiring NodeMem into an app that already
 * has a database. Their question is "what exactly must I implement?" — and
 * until this file existed the answer was spread across four modules, so the
 * only way to be sure was to read all of them. Everything a backend must
 * provide is below; nothing else in `src/core/` declares storage.
 *
 * NodeMem never opens a connection itself. It calls these seven methods and
 * nothing else, which is what "provider-agnostic" means here.
 */

import type { NoteworthyFinding } from "./classifier.js";
import type { AssistivePolicy } from "./policyResolver.js";

/** Where an activity row sits in the pipeline. Rows are patched, never deleted. */
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

/** One activity row as the backend stores it. */
export interface NoteworthyRow {
  id: string;
  roomId: string;
  status: string;
  entityNames: string[];
  updatedAt: number;
  finding?: NoteworthyFinding;
}

/** One "the user said no to this entity" record. */
export interface DismissalEntry {
  roomId: string;
  entityName: string;
  dismissedBy: string;
  dismissedAt: number;
  dismissCount: number;
}

/** Reads that stop the same entity being suggested twice, and cap the hourly volume. */
export interface DedupStore {
  /** Active noteworthy rows for a room (status = "noteworthy"), newest first. */
  listNoteworthy(roomId: string, limit?: number): Promise<NoteworthyRow[]>;
  /** How many noteworthy rows this room produced in the last hour. */
  countNoteworthyLastHour(roomId: string): Promise<number>;
}

/** Reads and writes behind "stop suggesting this entity, I said no". */
export interface DismissalStore {
  /** Has any of these entity names been dismissed in this room? */
  isEntityDismissed(roomId: string, entityNames: string[]): Promise<boolean>;
  /** Record a dismissal for one or more entities. */
  recordDismissal(roomId: string, entityNames: string[], dismissedBy: string): Promise<void>;
  /** Every dismissed entity for a room — for a settings screen or a debug view. */
  listDismissed(roomId: string): Promise<DismissalEntry[]>;
}

/** Where a room's assistive policy lives. Absent means "use the system default". */
export interface PolicyStore {
  getRoomPolicy(roomId: string): Promise<AssistivePolicy | null>;
  setRoomPolicy(roomId: string, policy: Omit<AssistivePolicy, "source">): Promise<void>;
}

/**
 * The single interface an adapter implements. `src/adapters/inMemoryAdapter.ts`
 * is the reference implementation and is what the tests and demos run against.
 */
export interface MemoryStore extends DismissalStore, DedupStore, PolicyStore {
  /** Write the scan's verdict back onto the row it scanned. */
  patchRow(
    id: string,
    patch: { status: ActivityStatus; finding?: NoteworthyFinding; reason?: string; updatedAt: number },
  ): Promise<void>;
}
