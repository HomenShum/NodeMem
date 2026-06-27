/**
 * In-memory adapter smoke — verifies the InMemoryAdapter implements
 * all MemoryStore port contracts correctly.
 */

import { InMemoryAdapter } from "../src/adapters/inMemoryAdapter.js";
import { scanActivity } from "../src/core/scanOrchestrator.js";

const jsonOut = process.argv.find((a) => a.startsWith("--json-out="))?.split("=")[1];

async function main() {
  const checks: Array<{ label: string; ok: boolean; detail?: string }> = [];
  const check = (label: string, ok: boolean, detail?: string) => {
    checks.push({ label, ok, detail });
    console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  };

  console.log("\n  NodeMem in-memory adapter smoke\n");

  const store = new InMemoryAdapter();

  // Test: insert + get
  const id = store.insertActivity({
    roomId: "r1", sourceKind: "message", sourceId: "m1",
    sourceHash: "h1", text: "test", visibility: "room",
  });
  check("insertActivity returns id", typeof id === "string", id);
  check("getRow returns the row", store.getRow(id) !== undefined);

  // Test: scan → noteworthy
  const text = "Met with Stripe about their Series B funding raise.";
  const id2 = store.insertActivity({
    roomId: "r1", sourceKind: "message", sourceId: "m2",
    sourceHash: "h2", text, visibility: "room",
  });
  const result = await scanActivity(store, {
    id: id2, roomId: "r1", sourceKind: "message", sourceId: "m2",
    sourceHash: "h2", text, visibility: "room",
  });
  check("Scan produces noteworthy", result.status === "noteworthy", result.status);

  // Test: listNoteworthyRows
  const noteworthy = store.listNoteworthyRows("r1");
  check("listNoteworthyRows has 1 item", noteworthy.length === 1, `${noteworthy.length} items`);

  // Test: dismissal
  await store.recordDismissal("r1", ["Stripe"], "user-1");
  const dismissed = await store.listDismissed("r1");
  check("Dismissal recorded", dismissed.length === 1, dismissed[0]?.entityName);

  const isDismissed = await store.isEntityDismissed("r1", ["Stripe"]);
  check("isEntityDismissed returns true", isDismissed === true);

  const notDismissed = await store.isEntityDismissed("r1", ["OtherCo"]);
  check("isEntityDismissed returns false for unknown", notDismissed === false);

  // Test: policy
  await store.setRoomPolicy("r1", {
    mode: "off", allowExternalCalls: false, maxSuggestionsPerHour: 0,
    maxApprovedBackgroundJobsPerDay: 0, disabledSignalKinds: [], approvedEntityWatchlist: [],
  });
  const policy = await store.getRoomPolicy("r1");
  check("getRoomPolicy returns the policy", policy?.mode === "off", policy?.mode);

  // Test: clear
  store.clear();
  check("clear empties rows", store.getAllRows().length === 0);
  check("clear empties dismissals", (await store.listDismissed("r1")).length === 0);

  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.filter((c) => !c.ok).length;

  const receipt = {
    timestamp: new Date().toISOString(),
    pass, fail, total: pass + fail,
    checks,
    status: fail === 0 ? "pass" : "fail",
  };

  if (jsonOut) {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(jsonOut, JSON.stringify(receipt, null, 2));
  }

  console.log(`\n  In-memory smoke: ${receipt.status.toUpperCase()} (${pass}/${pass + fail})`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Smoke error:", err);
  process.exit(1);
});
