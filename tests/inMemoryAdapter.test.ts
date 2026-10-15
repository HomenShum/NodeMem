/**
 * The reference backend does what the port promises.
 *
 * These assertions were previously a hand-rolled runner at
 * `scripts/nodemem-in-memory-smoke.ts` with its own pass/fail counter and JSON
 * receipt. They are the same checks, moved into the test runner the repo
 * already installs, so a new engineer finds them where tests live.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAdapter } from "../src/adapters/inMemoryAdapter.js";
import { scanActivity } from "../src/core/scanOrchestrator.js";
import { scanMessage } from "./room.js";

describe("InMemoryAdapter", () => {
  let store: InMemoryAdapter;

  beforeEach(() => {
    store = new InMemoryAdapter();
  });

  it("hands back an id for an inserted row, and that row can be read", () => {
    const id = store.insertActivity({
      roomId: "r1", sourceKind: "message", sourceId: "m1",
      sourceHash: "h1", text: "test", visibility: "room",
    });
    expect(typeof id).toBe("string");
    expect(store.getRow(id)).toBeDefined();
  });

  it("holds a scanned row as noteworthy and lists it", async () => {
    const result = await scanMessage(store, "Met with Stripe about their Series B funding raise.");
    expect(result.status).toBe("noteworthy");
    expect(store.listNoteworthyRows("r1")).toHaveLength(1);
  });

  it("remembers a dismissal, and only for the entity that was dismissed", async () => {
    await store.recordDismissal("r1", ["Stripe"], "user-1");
    expect(await store.listDismissed("r1")).toHaveLength(1);
    expect(await store.isEntityDismissed("r1", ["Stripe"])).toBe(true);
    expect(await store.isEntityDismissed("r1", ["OtherCo"])).toBe(false);
  });

  it("stores and returns a room policy", async () => {
    await store.setRoomPolicy("r1", {
      mode: "off", allowExternalCalls: false, maxSuggestionsPerHour: 0,
      maxApprovedBackgroundJobsPerDay: 0, disabledSignalKinds: [], approvedEntityWatchlist: [],
    });
    expect((await store.getRoomPolicy("r1"))?.mode).toBe("off");
  });

  it("clear() empties rows and dismissals", async () => {
    store.insertActivity({
      roomId: "r1", sourceKind: "message", sourceId: "m1",
      sourceHash: "h1", text: "test", visibility: "room",
    });
    await store.recordDismissal("r1", ["Stripe"], "user-1");
    store.clear();
    expect(store.getAllRows()).toHaveLength(0);
    expect(await store.listDismissed("r1")).toHaveLength(0);
  });

  it.each([
    { name: "a noteworthy message", text: "Met with CardioNova about their Series A funding raise.", off: false },
    { name: "an ignored message", text: "hello", off: false },
    { name: "a room with suggestions disabled", text: "Met with CardioNova about their Series A funding raise.", off: true },
  ])("refuses a forgotten row for $name and recovers after re-enqueue", async ({ text, off }) => {
    const input = { roomId: "r1", sourceKind: "message", sourceId: "saved-message", sourceHash: "saved-hash", text, visibility: "room" as const };
    const forgottenId = store.insertActivity(input);
    store.clear();
    if (off) await store.setRoomPolicy("r1", {
      mode: "off", allowExternalCalls: false, maxSuggestionsPerHour: 0,
      maxApprovedBackgroundJobsPerDay: 0, disabledSignalKinds: [], approvedEntityWatchlist: [],
    });

    await expect(scanActivity(store, { id: forgottenId, ...input }))
      .rejects.toThrow(`Activity row not found: ${forgottenId}`);
    expect(store.getAllRows()).toEqual([]);
    expect(store.listNoteworthyRows("r1")).toEqual([]);

    const id = store.insertActivity(input);
    const result = await scanActivity(store, { id, ...input });
    expect(result.status).toBe(off || text === "hello" ? "not_noteworthy" : "noteworthy");
    expect(store.getRow(id)).toMatchObject({ status: result.status, finding: result.finding });
    expect(store.getAllRows()).toHaveLength(1);
  });

  it("rejects burst and repeated absent-row retries without altering another room", async () => {
    await scanMessage(store, "Met with Stripe about their Series B funding raise.", { roomId: "retained-room" });
    const retained = structuredClone(store.getAllRows());
    const input = { roomId: "missing-room", sourceKind: "message", sourceId: "retry-message", sourceHash: "retry-hash", text: "Met with CardioNova about their Series A funding raise.", visibility: "room" as const };
    const retry = (id: string) => expect(scanActivity(store, { id, ...input }))
      .rejects.toThrow(`Activity row not found: ${id}`);
    await Promise.all(Array.from({ length: 8 }, (_, i) => retry(`burst-absent-${i}`)));
    for (let i = 0; i < 32; i++) await retry(`sequential-absent-${i}`);
    expect(store.getAllRows()).toEqual(retained);
    expect(store.listNoteworthyRows("missing-room")).toEqual([]);
  });
});
