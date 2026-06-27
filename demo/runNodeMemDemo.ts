/**
 * NodeMem demo entrypoint — prints the full pipeline run.
 */

import { runDemo } from "./demo-runner.js";

async function main() {
  console.log("\n  NodeMem — Passive memory demo");
  console.log('  Doctrine: "Notice passively, act explicitly."\n');

  const results = await runDemo();
  if (results.fail > 0) {
    console.log("  ✗ DEMO FAILED");
    process.exit(1);
  } else {
    console.log("  ✓ DEMO PASSED — all gates green\n");
  }
}

main().catch((err) => {
  console.error("Demo error:", err);
  process.exit(1);
});
