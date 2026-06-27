/**
 * Demo runner — shared logic for demo + smoke scripts.
 * Returns structured results instead of calling process.exit.
 */

import { InMemoryAdapter } from "../src/adapters/inMemoryAdapter.js";
import { scanActivity } from "../src/core/scanOrchestrator.js";
import { classifyNoteworthy } from "../src/core/classifier.js";
import { activityDedupeKey } from "../src/core/dedupeKey.js";
import { computeDebounce } from "../src/core/debouncer.js";

const ROOM_ID = "room-demo";
const ACTOR_ID = "user-alice";

export interface CheckResult {
  label: string;
  ok: boolean;
  detail?: string;
}

export interface DemoResults {
  pass: number;
  fail: number;
  checks: CheckResult[];
}

export async function runDemo(): Promise<DemoResults> {
  const checks: CheckResult[] = [];
  const store = new InMemoryAdapter();

  const check = (label: string, ok: boolean, detail?: string) => {
    checks.push({ label, ok, detail });
    const icon = ok ? "✓" : "✗";
    console.log(`  ${icon} ${label}${detail ? ` — ${detail}` : ""}`);
  };

  // Step 1: Classify
  console.log(`\n${"=".repeat(60)}\n  Step 1: Classify a chat message\n${"=".repeat(60)}\n`);

  const text1 = "Met with CardioNova last week. They just raised Series A and are piloting at three hospitals. Need to follow up on their runway.";
  const finding1 = classifyNoteworthy(text1);

  check("Entity detected", finding1.entities.length > 0, finding1.entities[0]?.displayName ?? "none");
  check("Score > 0.35", finding1.score > 0.35, `score=${finding1.score.toFixed(2)}`);
  check("Multiple signals", finding1.signals.length >= 3, finding1.signals.join(", "));
  check("Action is start_research_job", finding1.action === "start_research_job", finding1.action);
  check("Finance signal detected", finding1.signals.includes("finance_signal"));
  check("Person interaction detected", finding1.signals.includes("person_or_interaction"));

  // Step 2: Scan → noteworthy
  console.log(`\n${"=".repeat(60)}\n  Step 2: Scan activity → noteworthy suggestion\n${"=".repeat(60)}\n`);

  const dedupeKey = activityDedupeKey({
    roomId: ROOM_ID, sourceKind: "message", sourceId: "msg-1",
    eventKind: "idle_after_typing", actorId: ACTOR_ID,
  });
  console.log(`  Dedupe key: ${dedupeKey}`);

  const debounce = computeDebounce(Date.now(), null, 12_000);
  console.log(`  Debounce: delay=${debounce.effectiveDelay}ms`);

  const rowId1 = store.insertActivity({
    roomId: ROOM_ID, sourceKind: "message", sourceId: "msg-1",
    sourceHash: "hash-1", text: text1, visibility: "room",
  });

  const scanResult1 = await scanActivity(store, {
    id: rowId1, roomId: ROOM_ID, sourceKind: "message", sourceId: "msg-1",
    sourceHash: "hash-1", text: text1, visibility: "room",
  });

  check("Scan result is noteworthy", scanResult1.status === "noteworthy", scanResult1.status);
  check("Finding has entities", (scanResult1.finding?.entities.length ?? 0) > 0);

  // Step 3: Duplicate → dedup
  console.log(`\n${"=".repeat(60)}\n  Step 3: Duplicate entity → dedup suppresses\n${"=".repeat(60)}\n`);

  const text2 = "CardioNova is also mentioned in this other message about their pricing strategy.";
  const rowId2 = store.insertActivity({
    roomId: ROOM_ID, sourceKind: "message", sourceId: "msg-2",
    sourceHash: "hash-2", text: text2, visibility: "room",
  });

  const scanResult2 = await scanActivity(store, {
    id: rowId2, roomId: ROOM_ID, sourceKind: "message", sourceId: "msg-2",
    sourceHash: "hash-2", text: text2, visibility: "room",
  });

  check("Duplicate suppressed", scanResult2.status === "not_noteworthy", scanResult2.reason);

  // Step 4: Dismiss → re-scan → suppressed
  console.log(`\n${"=".repeat(60)}\n  Step 4: Dismiss entity → re-scan → suppressed\n${"=".repeat(60)}\n`);

  store.clear();
  await store.recordDismissal(ROOM_ID, ["CardioNova"], ACTOR_ID);
  const dismissed = await store.listDismissed(ROOM_ID);
  check("Dismissal recorded", dismissed.length > 0, `${dismissed[0]?.entityName} by ${dismissed[0]?.dismissedBy}`);

  const text3 = "New info about CardioNova's competitor landscape and market headwinds.";
  const rowId3 = store.insertActivity({
    roomId: ROOM_ID, sourceKind: "message", sourceId: "msg-3",
    sourceHash: "hash-3", text: text3, visibility: "room",
  });

  const scanResult3 = await scanActivity(store, {
    id: rowId3, roomId: ROOM_ID, sourceKind: "message", sourceId: "msg-3",
    sourceHash: "hash-3", text: text3, visibility: "room",
  });

  check("Dismissed entity suppressed", scanResult3.status === "not_noteworthy", scanResult3.reason);

  // Step 5: Policy "off"
  console.log(`\n${"=".repeat(60)}\n  Step 5: Policy 'off' → all suppressed\n${"=".repeat(60)}\n`);

  store.clear();
  await store.setRoomPolicy(ROOM_ID, {
    mode: "off", allowExternalCalls: false, maxSuggestionsPerHour: 0,
    maxApprovedBackgroundJobsPerDay: 0, disabledSignalKinds: [], approvedEntityWatchlist: [],
  });

  const rowId4 = store.insertActivity({
    roomId: ROOM_ID, sourceKind: "message", sourceId: "msg-4",
    sourceHash: "hash-4", text: text1, visibility: "room",
  });

  const scanResult4 = await scanActivity(store, {
    id: rowId4, roomId: ROOM_ID, sourceKind: "message", sourceId: "msg-4",
    sourceHash: "hash-4", text: text1, visibility: "room",
  });

  check("Policy 'off' suppresses all", scanResult4.status === "not_noteworthy", scanResult4.reason);

  // Step 6: Quota exceeded
  console.log(`\n${"=".repeat(60)}\n  Step 6: Per-room quota exceeded\n${"=".repeat(60)}\n`);

  store.clear();
  // Insert and scan 3 items (quota = 3) to fill the quota.
  for (let i = 0; i < 3; i++) {
    const text = `Company${i} just announced their Series A funding raise.`;
    const id = store.insertActivity({
      roomId: ROOM_ID, sourceKind: "message", sourceId: `msg-q-${i}`,
      sourceHash: `hash-q-${i}`, text, visibility: "room",
    });
    await scanActivity(store, {
      id, roomId: ROOM_ID, sourceKind: "message", sourceId: `msg-q-${i}`,
      sourceHash: `hash-q-${i}`, text, visibility: "room",
    }, { maxPerRoomPerHour: 3 });
  }

  // 4th item should be quota-suppressed.
  const textQuota = "NewCo announced their seed funding round today.";
  const rowId5 = store.insertActivity({
    roomId: ROOM_ID, sourceKind: "message", sourceId: "msg-q-3",
    sourceHash: "hash-q-3", text: textQuota, visibility: "room",
  });

  const scanResult5 = await scanActivity(store, {
    id: rowId5, roomId: ROOM_ID, sourceKind: "message", sourceId: "msg-q-3",
    sourceHash: "hash-q-3", text: textQuota, visibility: "room",
  }, { maxPerRoomPerHour: 3 });

  check("Quota exceeded suppresses", scanResult5.status === "not_noteworthy", scanResult5.reason);

  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.filter((c) => !c.ok).length;

  console.log(`\n${"=".repeat(60)}\n  Summary: Pass=${pass}  Fail=${fail}  Total=${pass + fail}\n${"=".repeat(60)}\n`);

  return { pass, fail, checks };
}
