/**
 * The pipeline, gate by gate.
 *
 * Each test drives one real message into a room and asserts which gate stopped
 * it — the `reason` written onto the row is the thing a support engineer reads
 * when a user asks "why did nothing appear?".
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { InMemoryAdapter } from "../src/adapters/inMemoryAdapter.js";
import { resolveAssistivePolicy, isSignalDisabled, isEntityWatchlisted } from "../src/core/policyResolver.js";
import { activityDedupeKey } from "../src/core/dedupeKey.js";
import { computeDebounce, clampQuietMs, DEFAULT_QUIET_MS, MAX_QUIET_MS } from "../src/core/debouncer.js";
import { scanMessage } from "./room.js";
import type { ScanConfig } from "../src/core/scanOrchestrator.js";

const roomPolicy = (limit: number) => ({
  mode: "suggestions_only" as const, allowExternalCalls: true, maxSuggestionsPerHour: limit,
  maxApprovedBackgroundJobsPerDay: 5, disabledSignalKinds: [], approvedEntityWatchlist: [],
});

describe("scanActivity", () => {
  let store: InMemoryAdapter;

  beforeEach(() => {
    store = new InMemoryAdapter();
  });

  it("turns a message worth a second look into a suggestion", async () => {
    const result = await scanMessage(store, "Met with CardioNova about their Series A funding raise.");
    expect(result.status).toBe("noteworthy");
    expect(result.finding?.entities.length).toBeGreaterThan(0);
  });

  it("suppresses a second suggestion about the same entity", async () => {
    await scanMessage(store, "CardioNova just raised Series A funding");
    const second = await scanMessage(store, "CardioNova pricing strategy update");
    expect(second.status).toBe("not_noteworthy");
    expect(second.reason).toBe("duplicate_entity");
  });

  it("suppresses an entity a human already dismissed", async () => {
    await store.recordDismissal("r1", ["CardioNova"], "user-1");
    const result = await scanMessage(store, "CardioNova announced their Series A funding raise");
    expect(result.status).toBe("not_noteworthy");
    expect(result.reason).toBe("previously_dismissed");
  });

  it("suppresses everything when the room turned passive intelligence off", async () => {
    await store.setRoomPolicy("r1", {
      mode: "off", allowExternalCalls: false, maxSuggestionsPerHour: 0,
      maxApprovedBackgroundJobsPerDay: 0, disabledSignalKinds: [], approvedEntityWatchlist: [],
    });
    const result = await scanMessage(store, "CardioNova announced their Series A funding raise");
    expect(result.status).toBe("not_noteworthy");
    expect(result.reason).toBe("policy_off");
  });

  it("stops at the room's hourly ceiling", async () => {
    const config = { maxPerRoomPerHour: 2 };
    await scanMessage(store, "Company0 announced their Series A funding raise", { config });
    await scanMessage(store, "Company1 announced their Series A funding raise", { config });
    const third = await scanMessage(store, "NewCo announced their seed funding round today", { config });
    expect(third.status).toBe("not_noteworthy");
    expect(third.reason).toBe("room_quota_exceeded");
  });

  // A room's numeric policy used to be resolved correctly, then ignored by the scan.
  it.each([
    { persona: "a room owner asks for one suggestion", room: 1, system: undefined, host: undefined, expected: 1 },
    { persona: "a room owner pauses suggestions with a zero budget", room: 0, system: undefined, host: undefined, expected: 0 },
    { persona: "a workspace operator sets the system budget to zero", room: undefined, system: 0, host: undefined, expected: 0 },
    { persona: "a workspace ceiling is lower than the room and host", room: 5, system: 2, host: 9, expected: 2 },
    { persona: "a host sets the lowest ceiling", room: 2, system: 5, host: 1, expected: 1 },
    { persona: "a host retains its default ceiling under higher policy limits", room: 20, system: 20, host: undefined, expected: 10 },
    { persona: "a host override cannot bypass the default system ceiling", room: undefined, system: undefined, host: 20, expected: 10 },
  ])("$persona during a meeting with 18 distinct company updates", async ({ room, system, host, expected }) => {
    if (room !== undefined) await store.setRoomPolicy("r1", roomPolicy(room));
    const config: ScanConfig = {
      maxPerRoomPerHour: host,
      systemDefaultPolicy: system === undefined ? undefined : { maxSuggestionsPerHour: system },
    };
    const results = [];
    for (let i = 0; i < 18; i++) {
      results.push(await scanMessage(store, `Company${i} announced their Series A funding raise`, { config }));
    }
    expect(results.filter((result) => result.status === "noteworthy")).toHaveLength(expected);
    expect(store.listNoteworthyRows("r1")).toHaveLength(expected);
    for (const result of results.slice(expected)) {
      expect(result.status).toBe("not_noteworthy");
      expect(result.reason).toBe("room_quota_exceeded");
    }
  });

  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, "2"])(
    "an operator can correct invalid host, system or room budget %s without a false verdict",
    async (limit) => {
      for (const source of ["host", "system", "room"] as const) {
        const adapter = new InMemoryAdapter();
        const count = vi.spyOn(adapter, "countNoteworthyLastHour");
        const patch = vi.spyOn(adapter, "patchRow");
        // JavaScript hosts can supply values that TypeScript callers would reject.
        if (source !== "host") await adapter.setRoomPolicy("r1", roomPolicy(source === "room" ? limit as number : 1));
        const config = source === "host"
          ? { maxPerRoomPerHour: limit as number }
          : source === "system" ? { systemDefaultPolicy: { maxSuggestionsPerHour: limit as number } } : {};
        await expect(scanMessage(adapter, "CardioNova announced their Series A funding raise", { config }))
          .rejects.toThrow(RangeError);
        expect(count).not.toHaveBeenCalled();
        expect(patch).not.toHaveBeenCalled();
        expect(adapter.getAllRows().map((row) => row.status)).toEqual(["queued"]);
        await adapter.setRoomPolicy("r1", roomPolicy(1));
        const recovered = await scanMessage(adapter, "CardioNova announced their Series A funding raise");
        expect(recovered.status).toBe("noteworthy");
        expect(adapter.listNoteworthyRows("r1")).toHaveLength(1);
      }
    },
  );

  it("distinguishes absent optional overrides from a room record missing its required budget", async () => {
    const config = { maxPerRoomPerHour: undefined, systemDefaultPolicy: { maxSuggestionsPerHour: undefined } };
    expect((await scanMessage(store, "CardioNova announced their Series A funding raise", { config })).status).toBe("noteworthy");
    await store.setRoomPolicy("r1", roomPolicy(undefined as unknown as number));
    await expect(scanMessage(store, "OtherCo announced their Series A funding raise", { config })).rejects.toThrow(RangeError);
    expect(store.listNoteworthyRows("r1")).toHaveLength(1);
  });

  it("keeps four rooms' budgets separate across 128 interleaved activity rows", async () => {
    const limits = [0, 1, 2, 3];
    for (const limit of limits) await store.setRoomPolicy(`room-${limit}`, roomPolicy(limit));
    const counts = await Promise.all(limits.map(async (limit) => {
      const roomId = `room-${limit}`;
      let admitted = 0;
      for (let i = 0; i < 32; i++) {
        const result = await scanMessage(store, `Company${i} announced their Series A funding raise`, { roomId });
        if (result.status === "noteworthy") admitted++;
        else expect(result.reason).toBe("room_quota_exceeded");
      }
      expect(store.listNoteworthyRows(roomId)).toHaveLength(limit);
      return admitted;
    }));
    expect(counts).toEqual(limits);
    expect(store.getAllRows()).toHaveLength(128);
  });

  it("withholds an entire simultaneous burst when the room owner sets zero", async () => {
    await store.setRoomPolicy("r1", roomPolicy(0));
    const results = await Promise.all(Array.from({ length: 32 }, (_, i) =>
      scanMessage(store, `Company${i} announced their Series A funding raise`)));
    expect(results.every((result) => result.status === "not_noteworthy" && result.reason === "room_quota_exceeded")).toBe(true);
    expect(store.listNoteworthyRows("r1")).toHaveLength(0);
  });

  it("applies an owner's changing budget to later scans without changing existing suggestions", async () => {
    await store.setRoomPolicy("r1", roomPolicy(2));
    for (let i = 0; i < 2; i++) {
      expect((await scanMessage(store, `Company${i} announced their Series A funding raise`)).status).toBe("noteworthy");
    }
    for (const limit of [0, 1]) {
      await store.setRoomPolicy("r1", roomPolicy(limit));
      expect((await scanMessage(store, `Company${limit + 2} announced their Series A funding raise`)).reason).toBe("room_quota_exceeded");
      expect(store.listNoteworthyRows("r1")).toHaveLength(2);
    }
    await store.setRoomPolicy("r1", roomPolicy(5));
    const options = { config: { maxPerRoomPerHour: 3 } };
    expect((await scanMessage(store, "Company4 announced their Series A funding raise", options)).status).toBe("noteworthy");
    expect((await scanMessage(store, "Company5 announced their Series A funding raise", options)).reason).toBe("room_quota_exceeded");
    expect(store.listNoteworthyRows("r1")).toHaveLength(3);
  });

  it("reports a failed budget read to the host without writing a successful suggestion", async () => {
    await store.setRoomPolicy("r1", roomPolicy(1));
    const count = vi.spyOn(store, "countNoteworthyLastHour").mockRejectedValueOnce(new Error("Memory read unavailable"));
    await expect(scanMessage(store, "CardioNova announced their Series A funding raise"))
      .rejects.toThrow("Memory read unavailable");
    expect(store.getAllRows().map((row) => row.status)).toEqual(["queued"]);
    count.mockRestore();
    expect((await scanMessage(store, "CardioNova announced their Series A funding raise")).status).toBe("noteworthy");
    expect((await scanMessage(store, "OtherCo announced their Series A funding raise")).reason).toBe("room_quota_exceeded");
  });

  it("stops at the classifier, before any policy is read, when nothing is worth a look", async () => {
    const result = await scanMessage(store, "lunch tomorrow, nothing noteworthy — just personal errands.");
    expect(result.status).toBe("not_noteworthy");
    // The first gate is the only one that writes no reason: nothing suppressed
    // this, it simply never rose to the bar.
    expect(result.reason).toBeUndefined();
  });

  it("suppresses a kind of signal the room muted", async () => {
    await store.setRoomPolicy("r1", {
      mode: "suggestions_only", allowExternalCalls: true, maxSuggestionsPerHour: 10,
      maxApprovedBackgroundJobsPerDay: 5, disabledSignalKinds: ["finance_signal"], approvedEntityWatchlist: [],
    });
    const result = await scanMessage(store, "CardioNova announced their Series A funding raise");
    expect(result.status).toBe("not_noteworthy");
    expect(result.reason).toBe("signal_disabled_by_policy");
  });

  it("suppresses an entity nobody approved when the room watches a list", async () => {
    await store.setRoomPolicy("r1", {
      mode: "approved_watchlist_only", allowExternalCalls: true, maxSuggestionsPerHour: 10,
      maxApprovedBackgroundJobsPerDay: 5, disabledSignalKinds: [], approvedEntityWatchlist: ["Stripe"],
    });
    const result = await scanMessage(store, "CardioNova announced their Series A funding raise");
    expect(result.status).toBe("not_noteworthy");
    expect(result.reason).toBe("not_on_watchlist");
  });

  // `docs/START_HERE.md` promises "one test per reason". Two reasons had no test
  // and nothing noticed for two waves. This is what notices.
  it("has a test above for every suppression reason the orchestrator can write", () => {
    const src = readFileSync(new URL("../src/core/scanOrchestrator.ts", import.meta.url), "utf8");
    const reasons = [...src.matchAll(/settle\("not_noteworthy", "(\w+)"\)/g)].map((m) => m[1]);
    expect(reasons.length).toBeGreaterThan(0);
    const self = readFileSync(new URL(import.meta.url), "utf8");
    for (const reason of reasons) {
      expect(self, `no test asserts the reason "${reason}"`).toContain(`toBe("${reason}")`);
    }
  });
});

describe("policyResolver", () => {
  it("returns the system default when the room has set nothing", async () => {
    const policy = await resolveAssistivePolicy(new InMemoryAdapter(), "r1");
    expect(policy.mode).toBe("suggestions_only");
    expect(policy.source).toBe("system_default");
  });

  it("lets the quieter of the two settings win", async () => {
    const store = new InMemoryAdapter();
    await store.setRoomPolicy("r1", {
      mode: "suggestions_only", allowExternalCalls: true, maxSuggestionsPerHour: 20,
      maxApprovedBackgroundJobsPerDay: 10, disabledSignalKinds: [], approvedEntityWatchlist: [],
    });
    const policy = await resolveAssistivePolicy(store, "r1", { mode: "off" });
    expect(policy.mode).toBe("off");
  });

  it("isSignalDisabled checks intersection", () => {
    expect(isSignalDisabled(["finance_signal"], ["finance_signal"])).toBe(true);
    expect(isSignalDisabled(["finance_signal"], ["source_url"])).toBe(false);
    expect(isSignalDisabled([], ["finance_signal"])).toBe(false);
  });

  it("isEntityWatchlisted ignores case", () => {
    expect(isEntityWatchlisted(["Stripe"], ["stripe"])).toBe(true);
    expect(isEntityWatchlisted(["Stripe"], ["CardioNova"])).toBe(false);
    expect(isEntityWatchlisted([], ["Stripe"])).toBe(false);
  });
});

describe("dedupeKey", () => {
  const key = (actorId: string) =>
    activityDedupeKey({ roomId: "r1", sourceKind: "message", sourceId: "m1", eventKind: "idle_after_typing", actorId });

  it("is deterministic", () => {
    expect(key("u1")).toBe(key("u1"));
    expect(key("u1")).toContain("activity:r1:message:m1:idle_after_typing:u1");
  });

  it("gives each author their own quiet window", () => {
    expect(key("u1")).not.toBe(key("u2"));
  });
});

describe("debouncer", () => {
  it("clamps the quiet window to [1s, 60s]", () => {
    expect(clampQuietMs(500)).toBe(1000);
    expect(clampQuietMs(12000)).toBe(12000);
    expect(clampQuietMs(120000)).toBe(60000);
    expect(clampQuietMs(undefined)).toBe(DEFAULT_QUIET_MS);
  });

  it("starts a fresh window on the first event", () => {
    const now = 1000000;
    const { state, effectiveDelay } = computeDebounce(now, null, 12000);
    expect(state.quietUntil).toBe(now + effectiveDelay);
    expect(state.maxWaitAt).toBe(now + MAX_QUIET_MS);
    expect(effectiveDelay).toBe(12000);
  });

  it("slides the window but still fires at maxWait, so a nonstop typist is not starved", () => {
    const now = 1000000;
    const existing = { quietUntil: now + 5000, maxWaitAt: now + 10000 };
    const { state, effectiveDelay } = computeDebounce(now + 3000, existing, 12000);
    expect(effectiveDelay).toBeLessThanOrEqual(7000); // maxWaitAt - (now+3000)
    expect(state.quietUntil).toBe(now + 3000 + effectiveDelay);
  });
});
