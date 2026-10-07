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
});
