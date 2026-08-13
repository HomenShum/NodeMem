/**
 * Capture gate for demo/graph-rail — the honesty assertion, executable.
 *
 * Serves the repo, runs the real pipeline in a browser, and FAILS (exit 1) if
 * any edge exists before a human confirmation. Then confirms one suggestion
 * and verifies exactly one traversal edge appears. Screenshots land in
 * assets/graph-rail/{before,after}-confirm.png.
 *
 * Phase 2 is the same page with the esm.sh CDN unreachable (defect D2). The
 * page's whole UI is one ES module resolved through an importmap; when that
 * graph fails to fetch the module body never runs, so the gate asserts the
 * failure is legible OUTSIDE the module — visible alert, named cause, working
 * recovery — instead of a blank frame under confident prose. Screenshot lands
 * in promotion/evidence/cdn-blocked-error-state.png.
 *
 *   node scripts/capture-graph-rail.mjs
 */

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".map": "application/json",
  ".json": "application/json",
  ".css": "text/css",
};

const server = http.createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
    const file = join(root, path);
    if (!file.startsWith(normalize(root))) throw new Error("outside root");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/demo/graph-rail/index.html`;

let failed = false;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
page.on("pageerror", (e) => console.error("  page error:", e.message));
await page.goto(url);
await page.waitForFunction(() => window.__graphRail?.pipelineDone === true, null, { timeout: 30000 });
await page.waitForTimeout(2500); // let the force layout settle

const before = await page.evaluate(() => {
  const s = window.__graphRail.session.getSnapshot();
  return {
    nodes: s.nodes.length,
    edges: s.edges.length,
    unmeasured: s.nodes.every((n) => n.count === undefined),
  };
});

// THE assertion: noticing must never have drawn an edge.
check("zero edges before any confirmation", before.edges === 0, `edges=${before.edges}`);
check("entities were noticed", before.nodes > 0, `nodes=${before.nodes}`);
check("every noticed entity is unmeasured (count undefined)", before.unmeasured);

await page.screenshot({ path: join(root, "assets", "graph-rail", "before-confirm.png") });

await page.locator('[data-testid="confirm-suggestion"]').first().click();
await page.waitForFunction(() => window.__graphRail.session.getSnapshot().edges.length === 1, null, { timeout: 5000 });
await page.waitForTimeout(2000);

const after = await page.evaluate(() => {
  const s = window.__graphRail.session.getSnapshot();
  return { edges: s.edges.length, types: s.edges.map((e) => e.type ?? e.attributes?.type ?? "unknown") };
});
check("exactly one edge after one confirmation", after.edges === 1, `edges=${after.edges}`);
check("the confirmed edge is traversal, not evidence", after.types.every((t) => String(t).includes("traversal")), `types=${after.types.join(",")}`);

await page.screenshot({ path: join(root, "assets", "graph-rail", "after-confirm.png") });
await page.close();

// ---------------------------------------------------------------- phase 2: D2
// Same page, esm.sh unreachable. Nothing the module renders can appear, so the
// only honest outcome is an error state produced outside the module.
console.log("\n  esm.sh blocked:");
const offline = await browser.newPage({ viewport: { width: 1400, height: 860 } });
await offline.route("**esm.sh**", (r) => r.abort());
await offline.goto(url);
await offline.locator('[data-testid="boot-error"]').waitFor({ state: "visible", timeout: 20000 }).catch(() => {});

const blocked = await offline.evaluate(() => {
  const panel = document.querySelector('[data-testid="boot-error"]');
  const caption = document.getElementById("caption");
  const visible = (el) => !!el && el.getClientRects().length > 0;
  return {
    alertVisible: visible(panel),
    role: panel?.getAttribute("role") ?? null,
    namesCause: /esm\.sh/.test(panel?.innerText ?? ""),
    retryVisible: visible(document.querySelector('[data-testid="boot-retry"]')),
    // the ledger's own probe: the user must be able to read that this failed
    readsAsFailure: /error|failed|retry|offline|could not/i.test(document.body.innerText),
    captionVisible: visible(caption),
  };
});

check("an error state is visible when esm.sh is blocked", blocked.alertVisible);
check("it is announced to assistive tech", blocked.role === "alert", `role=${blocked.role}`);
check("it names the cause (esm.sh)", blocked.namesCause);
check("it offers a recovery path", blocked.retryVisible);
check("the page reads as failed to a human", blocked.readsAsFailure);
check("the caption no longer describes a graph that is not there", !blocked.captionVisible);

await offline.screenshot({ path: join(root, "promotion", "evidence", "cdn-blocked-error-state.png") });

// A Retry that does not recover is decoration, not a recovery path.
await offline.unroute("**esm.sh**");
await offline.locator('[data-testid="boot-retry"]').click({ timeout: 5000 }).catch(() => {});
const recovered = await offline
  .waitForFunction(() => window.__graphRail?.pipelineDone === true, null, { timeout: 30000 })
  .then(() => true)
  .catch(() => false);
check("Retry recovers the page once the CDN is reachable again", recovered);
await offline.screenshot({ path: join(root, "promotion", "evidence", "cdn-blocked-after-retry.png") });

await browser.close();
server.close();
console.log(failed ? "\n  ✗ CAPTURE GATE FAILED" : "\n  ✓ CAPTURE GATE PASSED");
process.exit(failed ? 1 : 0);
