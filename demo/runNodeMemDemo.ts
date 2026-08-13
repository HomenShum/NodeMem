/**
 * The demo, and the proof, from one file.
 *
 * `npm run demo` runs the pipeline and prints every gate.
 * `npm run proof` runs the identical thing with `--json-out=<path>` and also
 * writes a receipt, which is what `nodekit.yaml` points its `proof` and
 * `doctor` commands at. Same checks either way — the receipt is a side effect,
 * never a second code path.
 *
 * Exit code is the verdict: 0 if every check passed, 1 if any failed.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { runDemo } from "./demo-runner.js";

const jsonOut = process.argv.find((a) => a.startsWith("--json-out="))?.split("=")[1];

async function main() {
  console.log("\n  NodeMem — Passive memory demo");
  console.log('  Doctrine: "Notice passively, act explicitly."\n');

  const { pass, fail, checks } = await runDemo();

  if (jsonOut) {
    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(
      jsonOut,
      JSON.stringify(
        { timestamp: new Date().toISOString(), pass, fail, total: pass + fail, checks, status: fail === 0 ? "pass" : "fail" },
        null,
        2,
      ),
    );
    console.log(`  Receipt: ${jsonOut}`);
  }

  console.log(fail > 0 ? `  ✗ DEMO FAILED (${pass}/${pass + fail})` : `  ✓ DEMO PASSED — all gates green (${pass}/${pass + fail})\n`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Demo error:", err);
  process.exit(1);
});
