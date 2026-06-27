/**
 * Convex adapter smoke — verifies the Convex schema exports are well-formed.
 * Does not require a running Convex deployment.
 *
 * For a live Convex smoke, deploy the schema to a dev deployment and run
 * the scan orchestrator against the Convex adapter.
 */

const jsonOut = process.argv.find((a) => a.startsWith("--json-out="))?.split("=")[1];

async function main() {
  const checks: Array<{ label: string; ok: boolean; detail?: string }> = [];
  const check = (label: string, ok: boolean, detail?: string) => {
    checks.push({ label, ok, detail });
    console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  };

  console.log("\n  NodeMem Convex adapter smoke (schema validation only)\n");

  // Verify the schema module loads and exports the expected tables.
  try {
    const schema = await import("../src/adapters/convexSchema.js");
    check("convexSchema module loads", true);

    check("roomActivityOutbox table exported", !!schema.roomActivityOutbox, typeof schema.roomActivityOutbox);
    check("roomDismissedEntities table exported", !!schema.roomDismissedEntities);
    check("roomAssistivePolicies table exported", !!schema.roomAssistivePolicies);
    check("suggestionFeedback table exported", !!schema.suggestionFeedback);
    check("roomSuggestionDigests table exported", !!schema.roomSuggestionDigests);
    check("default schema export exists", !!schema.default);
  } catch (err) {
    check("convexSchema module loads", false, String(err));
  }

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

  console.log(`\n  Convex smoke: ${receipt.status.toUpperCase()} (${pass}/${pass + fail})`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Smoke error:", err);
  process.exit(1);
});
