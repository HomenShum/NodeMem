/**
 * The Convex schema still loads, and still declares one table per thing NodeMem
 * remembers.
 *
 * Why a runtime check and not just `tsc`: this module is the one place the
 * package imports `convex/server`, and a broken or missing Convex install fails
 * at import time, not at typecheck time. Someone copying this file into their
 * own Convex project would hit that before anything else.
 *
 * Previously `scripts/nodemem-convex-smoke.ts`, a 59-line runner with its own
 * receipt writer.
 */

import { describe, it, expect } from "vitest";

describe("convexSchema", () => {
  it("exports the three tables that back the store contract", async () => {
    const schema = await import("../src/adapters/convexSchema.js");
    expect(schema.roomActivityOutbox).toBeTruthy();
    expect(schema.roomDismissedEntities).toBeTruthy();
    expect(schema.roomAssistivePolicies).toBeTruthy();
    expect(schema.default).toBeTruthy();
  });
});
