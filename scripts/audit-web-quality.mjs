/**
 * Web-quality audit of demo/graph-rail — condition 8, executable.
 *
 * Runs the two machine audits against the page as it is actually served, writes
 * their raw output to promotion/evidence/audit/, and fails (exit 1) on a
 * regression against the thresholds below. The JSON receipts are the artifact;
 * this file is the producer that regenerates them, which is the half that was
 * missing when this condition sat UNVERIFIED.
 *
 *   node scripts/audit-web-quality.mjs
 *   node scripts/audit-web-quality.mjs --tag before   # writes *-before.json
 *
 * Both tools are run through `npx --yes` rather than added to devDependencies:
 * they are audit rigs pulled at a pinned version for a run, not code this
 * package ships. Pinned so a later release cannot silently move the numbers.
 *
 * Thresholds are the gate's language ("no major unresolved finding"), expressed
 * as numbers:
 * - axe: zero serious or critical violations. Moderate/minor are recorded, not
 *   gated — axe's own severity scale is what decides "major", not a score.
 * - Lighthouse accessibility ≥ 0.95, best-practices ≥ 0.95.
 * - Core Web Vitals in the "good" band: LCP ≤ 2500ms, CLS ≤ 0.1.
 * - Performance score is RECORDED, NOT GATED. Lighthouse's mobile preset
 *   applies a 4x CPU slowdown to a page that evaluates React, sigma and
 *   graphology from a CDN; the resulting TBT is a real number about a real
 *   configuration, and it is reported in PROMOTION_LOG.md rather than hidden —
 *   but pinning a score here would only invite someone to tune the threshold.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { serveRepo, DEMO_PATH } from "./serve.mjs";

const LIGHTHOUSE = "lighthouse@13.4.1";
const AXE = "@axe-core/cli@4.13.0";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "promotion", "evidence", "audit");
mkdirSync(outDir, { recursive: true });

const tagArg = process.argv.find((a) => a.startsWith("--tag="));
const tag = tagArg ? `-${tagArg.slice(6)}` : "";

// A fixed port so the URL in the receipts is one a human can re-open by hand.
// Falls back to an ephemeral port when it is taken — back-to-back audit runs
// leave sockets in TIME_WAIT and Windows refuses the rebind.
const { server, origin } = await serveRepo(Number(process.env.PORT) || 4911).catch(() => serveRepo(0));
const url = `${origin}${DEMO_PATH}`;
console.log(`  auditing ${url}\n`);

let failed = false;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
};

const win = process.platform === "win32";
/**
 * Run an audit tool and wait for it — ASYNCHRONOUSLY, which is load-bearing.
 * The page under audit is served by this very process, so a synchronous
 * `execSync` blocks the event loop, the server never accepts the connection,
 * and the tool reports `net::ERR_CONNECTION_REFUSED` against a server that is
 * demonstrably listening. Measured: execSync → axe fails in 240s; spawn → passes.
 *
 * @param {string[]} args - argv for npx; quoted on Windows because Node >= 20
 *   refuses to spawn a `.cmd` without a shell (CVE-2024-27980).
 * @param {string} outPath - the receipt the tool must leave behind. Tools that
 *   exit non-zero *because they found something* (axe does) still succeed here;
 *   a missing file is the only real failure.
 */
const npx = (args, outPath) =>
  new Promise((res, rej) => {
    if (existsSync(outPath)) rmSync(outPath);
    const child = spawn(win ? "npx.cmd" : "npx", win ? args.map((a) => `"${a}"`) : args, {
      cwd: root,
      stdio: ["ignore", "inherit", "inherit"],
      shell: win,
    });
    child.on("error", rej);
    child.on("close", () => (existsSync(outPath) ? res() : rej(new Error(`${args[1]} wrote no receipt at ${outPath}`))));
  });

// ------------------------------------------------------------- Lighthouse
const lhPath = join(outDir, `lighthouse${tag}.json`);
await npx(["--yes", LIGHTHOUSE, url, "--output=json", `--output-path=${lhPath}`, "--chrome-flags=--headless", "--quiet"], lhPath);
const lh = JSON.parse(readFileSync(lhPath, "utf8"));
const score = (c) => lh.categories[c]?.score ?? null;
const num = (a) => lh.audits[a]?.numericValue ?? null;

const lcp = num("largest-contentful-paint");
const cls = num("cumulative-layout-shift");
console.log(`\n  Lighthouse ${lh.lighthouseVersion} (${lh.configSettings.formFactor}, ${lh.configSettings.throttling.cpuSlowdownMultiplier}x CPU):`);
check("accessibility ≥ 0.95", score("accessibility") >= 0.95, `${score("accessibility")}`);
check("best-practices ≥ 0.95", score("best-practices") >= 0.95, `${score("best-practices")}`);
check("LCP ≤ 2500ms", lcp <= 2500, `${Math.round(lcp)}ms`);
check("CLS ≤ 0.1", cls <= 0.1, cls.toFixed(3));
const consoleErrors = lh.audits["errors-in-console"]?.details?.items ?? [];
check("no browser errors logged to the console", consoleErrors.length === 0, consoleErrors.map((i) => i.description).join(" | ") || "none");
console.log(`  · performance ${score("performance")} (recorded, not gated) — TBT ${Math.round(num("total-blocking-time"))}ms, TTI ${Math.round(num("interactive"))}ms`);
console.log(`  · seo ${score("seo")}`);

// -------------------------------------------------------------------- axe
const axePath = join(outDir, `axe${tag}.json`);
// `--save` is resolved relative to cwd, not absolute — an absolute path gets
// concatenated onto cwd and the write ENOENTs while the CLI still exits 0.
await npx(["--yes", AXE, url, "--save", `promotion/evidence/audit/axe${tag}.json`], axePath);
const axeRaw = JSON.parse(readFileSync(axePath, "utf8"));
const axe = Array.isArray(axeRaw) ? axeRaw[0] : axeRaw;
const bySeverity = (s) => axe.violations.filter((v) => v.impact === s);
const serious = [...bySeverity("critical"), ...bySeverity("serious")];

console.log(`\n  axe-core ${axe.testEngine?.version ?? AXE}:`);
check(
  "zero serious or critical violations",
  serious.length === 0,
  serious.length ? serious.map((v) => `${v.id} (${v.impact}, ${v.nodes.length} nodes)`).join(", ") : `${axe.violations.length} total violations, ${axe.passes.length} rules passed`,
);
for (const v of axe.violations.filter((v) => !serious.includes(v))) {
  console.log(`  · ${v.id} (${v.impact}, ${v.nodes.length} nodes) — recorded, below the major bar`);
}

server.close();
console.log(`\n  → ${lhPath.replace(root, "")}\n  → ${axePath.replace(root, "")}`);
console.log(failed ? "\n  ✗ WEB-QUALITY AUDIT FAILED" : "\n  ✓ WEB-QUALITY AUDIT PASSED");
process.exit(failed ? 1 : 0);
