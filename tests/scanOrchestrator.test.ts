import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAdapter } from "../src/adapters/inMemoryAdapter.js";
import { scanActivity } from "../src/core/scanOrchestrator.js";
import { resolveAssistivePolicy, SYSTEM_DEFAULT_POLICY, isSignalDisabled, isEntityWatchlisted, signalFingerprintHash } from "../src/core/policyResolver.js";
import { isEntityDismissedSync } from "../src/core/dismissalLearner.js";
import { activityDedupeKey } from "../src/core/dedupeKey.js";
import { computeDebounce, clampQuietMs, DEFAULT_QUIET_MS, MAX_QUIET_MS } from "../src/core/debouncer.js";

describe("InMemoryAdapter + scanActivity", () => {
  let store: InMemoryAdapter;

  beforeEach(() => {
    store = new InMemoryAdapter();
  });

  it("scans noteworthy text and produces a noteworthy row", async () => {
    const text = "Met with CardioNova about their Series A funding raise.";
    const id = store.insertActivity({
      roomId: "r1", sourceKind: "message", sourceId: "m1",
      sourceHash: "h1", text, visibility: "room",
    });
    const result = await scanActivity(store, {
      id, roomId: "r1", sourceKind: "message", sourceId: "m1",
      sourceHash: "h1", text, visibility: "room",
    });
    expect(result.status).toBe("noteworthy");
    expect(result.finding?.entities.length).toBeGreaterThan(0);
  });

  it("suppresses duplicate entities", async () => {
    const text1 = "CardioNova just raised Series A funding";
    const id1 = store.insertActivity({
      roomId: "r1", sourceKind: "message", sourceId: "m1",
      sourceHash: "h1", text: text1, visibility: "room",
    });
    await scanActivity(store, {
      id: id1, roomId: "r1", sourceKind: "message", sourceId: "m1",
      sourceHash: "h1", text: text1, visibility: "room",
    });

    const text2 = "CardioNova pricing strategy update";
    const id2 = store.insertActivity({
      roomId: "r1", sourceKind: "message", sourceId: "m2",
      sourceHash: "h2", text: text2, visibility: "room",
    });
    const result2 = await scanActivity(store, {
      id: id2, roomId: "r1", sourceKind: "message", sourceId: "m2",
      sourceHash: "h2", text: text2, visibility: "room",
    });
    expect(result2.status).toBe("not_noteworthy");
    expect(result2.reason).toBe("duplicate_entity");
  });

  it("suppresses dismissed entities", async () => {
    await store.recordDismissal("r1", ["CardioNova"], "user-1");
    const text = "CardioNova announced their Series A funding raise";
    const id = store.insertActivity({
      roomId: "r1", sourceKind: "message", sourceId: "m1",
      sourceHash: "h1", text, visibility: "room",
    });
    const result = await scanActivity(store, {
      id, roomId: "r1", sourceKind: "message", sourceId: "m1",
      sourceHash: "h1", text, visibility: "room",
    });
    expect(result.status).toBe("not_noteworthy");
    expect(result.reason).toBe("previously_dismissed");
  });

  it("suppresses all when policy is off", async () => {
    await store.setRoomPolicy("r1", {
      mode: "off", allowExternalCalls: false, maxSuggestionsPerHour: 0,
      maxApprovedBackgroundJobsPerDay: 0, disabledSignalKinds: [], approvedEntityWatchlist: [],
    });
    const text = "CardioNova announced their Series A funding raise";
    const id = store.insertActivity({
      roomId: "r1", sourceKind: "message", sourceId: "m1",
      sourceHash: "h1", text, visibility: "room",
    });
    const result = await scanActivity(store, {
      id, roomId: "r1", sourceKind: "message", sourceId: "m1",
      sourceHash: "h1", text, visibility: "room",
    });
    expect(result.status).toBe("not_noteworthy");
    expect(result.reason).toBe("policy_off");
  });

  it("enforces per-room quota", async () => {
    // Set quota to 2, insert 2 noteworthy items, 3rd should be suppressed.
    for (let i = 0; i < 2; i++) {
      const text = `Company${i} announced their Series A funding raise`;
      const id = store.insertActivity({
        roomId: "r1", sourceKind: "message", sourceId: `m${i}`,
        sourceHash: `h${i}`, text, visibility: "room",
      });
      await scanActivity(store, {
        id, roomId: "r1", sourceKind: "message", sourceId: `m${i}`,
        sourceHash: `h${i}`, text, visibility: "room",
      }, { maxPerRoomPerHour: 2 });
    }
    const text = "NewCo announced their seed funding round today";
    const id = store.insertActivity({
      roomId: "r1", sourceKind: "message", sourceId: "m2",
      sourceHash: "h2", text, visibility: "room",
    });
    const result = await scanActivity(store, {
      id, roomId: "r1", sourceKind: "message", sourceId: "m2",
      sourceHash: "h2", text, visibility: "room",
    }, { maxPerRoomPerHour: 2 });
    expect(result.status).toBe("not_noteworthy");
    expect(result.reason).toBe("room_quota_exceeded");
  });
});

describe("policyResolver", () => {
  it("returns system default when no room policy", async () => {
    const store = new InMemoryAdapter();
    const policy = await resolveAssistivePolicy(store, "r1");
    expect(policy.mode).toBe("suggestions_only");
    expect(policy.source).toBe("system_default");
  });

  it("most restrictive wins", async () => {
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

  it("isEntityWatchlisted checks case-insensitive", () => {
    expect(isEntityWatchlisted(["Stripe"], ["stripe"])).toBe(true);
    expect(isEntityWatchlisted(["Stripe"], ["CardioNova"])).toBe(false);
    expect(isEntityWatchlisted([], ["Stripe"])).toBe(false);
  });

  it("signalFingerprintHash is deterministic", () => {
    const h1 = signalFingerprintHash({ sourceKind: "message", signalKind: "finance_signal" });
    const h2 = signalFingerprintHash({ sourceKind: "message", signalKind: "finance_signal" });
    expect(h1).toBe(h2);
    expect(h1).toContain("message|finance_signal");
  });
});

describe("dismissalLearner", () => {
  it("isEntityDismissedSync checks set membership", () => {
    const dismissed = new Set(["cardionova", "stripe"]);
    expect(isEntityDismissedSync(dismissed, ["CardioNova"])).toBe(true);
    expect(isEntityDismissedSync(dismissed, ["OtherCo"])).toBe(false);
    expect(isEntityDismissedSync(dismissed, [])).toBe(false);
  });
});

describe("dedupeKey", () => {
  it("produces deterministic keys", () => {
    const key1 = activityDedupeKey({
      roomId: "r1", sourceKind: "message", sourceId: "m1",
      eventKind: "idle_after_typing", actorId: "u1",
    });
    const key2 = activityDedupeKey({
      roomId: "r1", sourceKind: "message", sourceId: "m1",
      eventKind: "idle_after_typing", actorId: "u1",
    });
    expect(key1).toBe(key2);
    expect(key1).toContain("activity:r1:message:m1:idle_after_typing:u1");
  });

  it("different actors produce different keys", () => {
    const key1 = activityDedupeKey({
      roomId: "r1", sourceKind: "message", sourceId: "m1",
      eventKind: "idle_after_typing", actorId: "u1",
    });
    const key2 = activityDedupeKey({
      roomId: "r1", sourceKind: "message", sourceId: "m1",
      eventKind: "idle_after_typing", actorId: "u2",
    });
    expect(key1).not.toBe(key2);
  });
});

describe("debouncer", () => {
  it("clamps quiet ms to [1s, 60s]", () => {
    expect(clampQuietMs(500)).toBe(1000);
    expect(clampQuietMs(12000)).toBe(12000);
    expect(clampQuietMs(120000)).toBe(60000);
    expect(clampQuietMs(undefined)).toBe(DEFAULT_QUIET_MS);
  });

  it("creates fresh state for new debounce", () => {
    const now = 1000000;
    const { state, effectiveDelay } = computeDebounce(now, null, 12000);
    expect(state.quietUntil).toBe(now + effectiveDelay);
    expect(state.maxWaitAt).toBe(now + MAX_QUIET_MS);
    expect(effectiveDelay).toBe(12000);
  });

  it("slides window for existing debounce but caps at maxWait", () => {
    const now = 1000000;
    const existing = { quietUntil: now + 5000, maxWaitAt: now + 10000 };
    const { state, effectiveDelay } = computeDebounce(now + 3000, existing, 12000);
    // effectiveDelay should be capped by maxWaitAt - now
    expect(effectiveDelay).toBeLessThanOrEqual(7000); // maxWaitAt - (now+3000) = 10000 - 3000 = 7000
    expect(state.quietUntil).toBe(now + 3000 + effectiveDelay);
  });
});
