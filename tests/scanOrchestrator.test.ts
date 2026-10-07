/**
 * The pipeline, gate by gate.
 *
 * Each test drives one real message into a room and asserts which gate stopped
 * it — the `reason` written onto the row is the thing a support engineer reads
 * when a user asks "why did nothing appear?".
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { InMemoryAdapter } from "../src/adapters/inMemoryAdapter.js";
import { resolveAssistivePolicy, isSignalDisabled, isEntityWatchlisted } from "../src/core/policyResolver.js";
import { activityDedupeKey } from "../src/core/dedupeKey.js";
import { computeDebounce, clampQuietMs, DEFAULT_QUIET_MS, MAX_QUIET_MS } from "../src/core/debouncer.js";
import { scanMessage } from "./room.js";

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
