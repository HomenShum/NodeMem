/**
 * One line of setup for the tests, so each test shows only what it is about.
 *
 * A real host inserts an activity row when a user stops typing, then scans it.
 * Both steps together are `scanMessage`. The fields a test does not care about
 * (source ids, hashes, visibility) get plausible defaults here instead of being
 * retyped in every case.
 */

import { InMemoryAdapter } from "../src/adapters/inMemoryAdapter.js";
import { scanActivity, type ScanConfig, type ScanResult } from "../src/core/scanOrchestrator.js";

let seq = 0;

/** Insert one message into a room and run the scan over it. */
export function scanMessage(
  store: InMemoryAdapter,
  text: string,
  options: { roomId?: string; config?: ScanConfig } = {},
): Promise<ScanResult> {
  const roomId = options.roomId ?? "r1";
  const n = ++seq;
  const row = { roomId, sourceKind: "message", sourceId: `m${n}`, sourceHash: `h${n}`, text, visibility: "room" } as const;
  const id = store.insertActivity(row);
  return scanActivity(store, { id, ...row }, options.config);
}
