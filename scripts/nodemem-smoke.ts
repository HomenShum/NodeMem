/**
 * NodeMem smoke — runs the demo and writes a JSON receipt.
 * Verifies the full pipeline: classify → scan → dedup → dismiss → policy.
 */

import { runDemo } from "../demo/demo-runner.js";

const jsonOut = process.argv.find((a) => a.startsWith("--json-out="))?.split("=")[1];

async function main() {
  const results = await runDemo();
  const receipt = {
    timestamp: new Date().toISOString(),
    pass: results.pass,
    fail: results.fail,
    total: results.pass + results.fail,
    checks: results.checks,
    status: results.fail === 0 ? "pass" : "fail",
  };

  if (jsonOut) {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(jsonOut, JSON.stringify(receipt, null, 2));
  }

  console.log(`\nSmoke: ${receipt.status.toUpperCase()} (${receipt.pass}/${receipt.total} checks)`);
  if (receipt.fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Smoke error:", err);
  process.exit(1);
});
