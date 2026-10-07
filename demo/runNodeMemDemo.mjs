/**
 * NodeMem zero-dependency demo — no install, no build, just `node demo/runNodeMemDemo.mjs`.
 *
 * The classifier + minimal in-memory store live in ./nodeMemDemoCore.mjs so
 * the browser graph rail (demo/graph-rail/) runs the SAME pipeline this CLI
 * proves. Zero npm dependencies either way.
 */

import { classifyNoteworthy, InMemoryStore, DEMO_EVENTS } from "./nodeMemDemoCore.mjs";

// --- Demo ---
console.log("\n  NodeMem — Zero-dependency demo");
console.log('  Doctrine: "Notice passively, act explicitly."\n');

const store = new InMemoryStore();
let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++; else fail++;
};

// 1. Classify
const text1 = DEMO_EVENTS[0];
const f1 = classifyNoteworthy(text1);
check("Entity detected", f1.entities.length > 0, f1.entities[0]?.displayName);
check("Score > 0.35", f1.score > 0.35, `score=${f1.score.toFixed(2)}`);
check("4+ signals", f1.signals.length >= 4, `${f1.signals.length} signals`);
check("Action: start_research_job", f1.action === "start_research_job");

// 2. Dismissal learning
await store.recordDismissal("r1", ["CardioNova"], "user-1");
const isDismissed = await store.isEntityDismissed("r1", ["CardioNova"]);
check("Dismissal learning works", isDismissed === true);

// 3. Determinism
const f2 = classifyNoteworthy(text1);
check("Classifier is deterministic", JSON.stringify(f1) === JSON.stringify(f2));

console.log(`\n  Pass: ${pass}  Fail: ${fail}`);
if (fail > 0) { console.log("  ✗ FAILED"); process.exit(1); }
else { console.log("  ✓ PASSED\n"); }
