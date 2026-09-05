/**
 * A developer reviews the real fixed-fixture demo with keyboard and pointer:
 * notice -> confirm/dismiss -> readable outcome -> retry/reload.
 * Run: node scripts/verify-ui-repair.mjs
 * Optional first argument selects a NEW evidence directory. No provider or data writes.
 */
import { chromium } from "playwright";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { serveRepo, DEMO_PATH } from "./serve.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const sources = ["demo/graph-rail/index.html", "demo/graph-rail/main.js", "demo/nodeMemDemoCore.mjs",
  "vendor/nodegraph-live/NodeGraph.js", "vendor/nodegraph-live/graph-model.js",
  "vendor/nodegraph-live/session.js", "vendor/nodegraph-live/index.js", "vendor/nodegraph-live/react.js",
  "scripts/serve.mjs", "scripts/verify-ui-repair.mjs", "package.json", "package-lock.json", ".gitattributes"];
const hash = b => createHash("sha256").update(b).digest("hex");
const sourceHashes = async () => Object.fromEntries(await Promise.all(sources.map(async f => [f, hash(await readFile(path.join(root, f)))])));
const out = path.resolve(process.argv[2] ?? path.join(root, "evidence/nodemem-ui-repair-20260905/runs", new Date().toISOString().replaceAll(":", "-")));
await mkdir(path.dirname(out), { recursive: true });
await mkdir(out, { recursive: false });
const report = { proof: "E6B-NODEMEM-REPAIR-01", startedAt: new Date().toISOString(), sourceBefore: await sourceHashes(),
  node: process.version, playwright: require("playwright/package.json").version, axe: require("axe-core/package.json").version,
  checks: [], cells: [], console: [], network: [], sustained: [], fullProductReadiness: "OPEN" };
const check = (name, passed, detail) => { report.checks.push({ name, passed, detail }); console.log((passed ? "PASS " : "FAIL ") + name); };
let browser, server, origin;
const state = page => page.evaluate(() => {
  const graph = window.__graphRail?.session.getSnapshot();
  return { nodes: graph?.nodes ?? [], edges: graph?.edges ?? [], ready: !!window.__graphRail?.pipelineDone,
    resolved: [...document.querySelectorAll(".suggestion.resolved")].map(e => e.innerText),
    active: { tag: document.activeElement.tagName, id: document.activeElement.id, className: document.activeElement.className, text: document.activeElement.textContent.slice(0, 180) },
    overflow: document.documentElement.scrollWidth - innerWidth, labels: window.__labelDraws, labelFrame: window.__labelFrameId,
    logRows: document.querySelector("#log").children.length, scrollY, width: innerWidth, height: innerHeight,
    disclosure: document.querySelector(".sub").innerText, stageVisible: !!document.querySelector("#stage").getClientRects().length };
});
async function capture(page, name, axe = true) {
  const observed = await state(page);
  if (axe) {
    await page.addScriptTag({ content: axeSource });
    observed.axe = await page.evaluate(async () => {
      const r = await window.axe.run();
      return { violations: r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) };
    });
  }
  await writeFile(path.join(out, name + ".json"), JSON.stringify(observed, null, 2) + "\n");
  await writeFile(path.join(out, name + ".html"), await page.content());
  await writeFile(path.join(out, name + ".ax.txt"), await page.locator("body").ariaSnapshot());
  await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true });
  await page.screenshot({ path: path.join(out, name + "-viewport.png") });
  report.cells.push({ name, width: observed.width, height: observed.height, overflow: observed.overflow, violations: observed.axe?.violations ?? [] });
  check(name + " reflows without horizontal document overflow", observed.overflow <= 0, observed.overflow);
  if (axe) check(name + " has no new axe violations beyond the existing log-focus disagreement", observed.axe.violations.every(v => v.id === "scrollable-region-focusable"), observed.axe.violations);
  return observed;
}
async function context(viewport) {
  const c = await browser.newContext({ viewport });
  await c.addInitScript(() => {
    window.__labelDraws = {};
    window.__labelFrameId = 0;
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.classList.contains("sigma-labels")) {
        window.__labelDraws = {};
        window.__labelFrameId++;
      }
      return clear.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
      if (this.canvas.classList.contains("sigma-labels") && typeof text === "string" && text.length <= 120 && Object.keys(window.__labelDraws).length < 50) {
        const m = this.measureText(text), t = this.getTransform();
        window.__labelDraws[text] = { text, left: x - m.actualBoundingBoxLeft, right: x + m.actualBoundingBoxRight,
          top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent,
          width: this.canvas.width / t.a, height: this.canvas.height / t.d, frame: window.__labelFrameId };
      }
      return original.call(this, text, x, y, ...rest);
    };
  });
  c.on("page", p => {
    p.setDefaultTimeout(10000);
    p.on("pageerror", e => { if (report.console.length < 200) report.console.push({ type: "pageerror", text: e.message }); });
    p.on("console", m => { if (["warning", "error"].includes(m.type()) && report.console.length < 200) report.console.push({ type: m.type(), text: m.text() }); });
    p.on("response", r => { if (r.url().startsWith("https://esm.sh/") && report.network.length < 800) report.network.push({ url: r.url(), status: r.status() }); });
  });
  return c;
}
async function ready(p) {
  await p.waitForFunction(() => window.__graphRail?.pipelineDone === true, null, { timeout: 30000 });
  await p.waitForTimeout(900);
}
function labelsFit(label, s) {
  const labels = s.nodes.map(n => n.label);
  check(label + " all fixture labels drawn in current frame within both canvas axes", labels.length > 0 && labels.every(text => {
    const d = s.labels[text]; return d && d.frame === s.labelFrame && d.left >= 0 && d.right <= d.width + 0.5 && d.top >= 0 && d.bottom <= d.height + 0.5;
  }), s.labels);
}
try {
  ({ server, origin } = await serveRepo());
  browser = await chromium.launch(); report.browser = browser.version(); report.route = DEMO_PATH;
  for (const [width, height] of [[360,800],[390,844],[768,1024],[1024,768],[1440,960],[1920,1080]]) {
    const name = width + "x" + height, c = await context({ width, height }), p = await c.newPage();
    let release; const gate = new Promise(r => { release = r; });
    await p.route("**/demo/graph-rail/main.js", async route => { const response = await route.fetch(); await gate; await route.fulfill({ response }); });
    await p.goto(origin + DEMO_PATH, { waitUntil: "commit" });
    await p.locator("#boot-status").waitFor();
    await capture(p, name + "-loading");
    release(); await ready(p); await p.unroute("**/demo/graph-rail/main.js");
    const initial = await capture(p, name + "-noticed"); labelsFit(name + " noticed", initial);
    check(name + " passive notice has zero edges and unmeasured nodes", initial.nodes.length === 3 && initial.edges.length === 0 && initial.nodes.every(n => n.count === undefined));
    check(name + " reset lifetime is disclosed", /fixed demo inputs/i.test(initial.disclosure) && /until you reload/i.test(initial.disclosure));
    const jump = p.getByRole("link", { name: "Review suggestions" });
    const jumpBox = await jump.boundingBox();
    check(name + " decision link is in initial viewport", jumpBox.y >= 0 && jumpBox.y + jumpBox.height <= height, jumpBox);
    await jump.focus(); await p.keyboard.press("Enter");
    check(name + " keyboard decision link focuses suggestions", (await state(p)).active.id === "suggestions");
    await p.keyboard.press("Tab");
    check(name + " next Tab reaches Confirm", await p.getByTestId("confirm-suggestion").first().evaluate(e => e === document.activeElement));
    await capture(p, name + "-focus", false);
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => document.querySelectorAll(".resolved").length === 1);
    const confirmed = await capture(p, name + "-confirmed");
    check(name + " confirm has one traversal, readable status and retained focus", confirmed.edges.length === 1 && confirmed.edges.every(e => String(e.type).includes("traversal")) && confirmed.active.className === "state" && confirmed.active.text.startsWith("confirmed"));
    check(name + " confirmed contrast passes", !confirmed.axe.violations.some(v => v.id === "color-contrast"), confirmed.axe.violations);
    await p.keyboard.press("Tab");
    check(name + " focus advances to next remaining Confirm", await p.getByTestId("confirm-suggestion").first().evaluate(e => e === document.activeElement));
    await p.keyboard.press("Tab"); await p.keyboard.press("Space");
    await p.waitForFunction(() => document.querySelectorAll(".resolved").length === 2);
    const dismissed = await capture(p, name + "-dismissed");
    check(name + " dismissal preserves graph and focuses readable outcome", JSON.stringify(dismissed.nodes) === JSON.stringify(confirmed.nodes) && JSON.stringify(dismissed.edges) === JSON.stringify(confirmed.edges) && dismissed.active.className === "state" && dismissed.active.text.startsWith("dismissed"));
    check(name + " dismissed contrast passes", !dismissed.axe.violations.some(v => v.id === "color-contrast"), dismissed.axe.violations);
    const clearFocus = await p.locator(".state:focus").evaluate(e => e.getBoundingClientRect().top - e.previousElementSibling.getBoundingClientRect().bottom);
    check(name + " outcome focus outline clears preceding explanation", clearFocus >= 5, clearFocus);
    await p.getByTestId("nodegraph-fit").focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
    const fit = await capture(p, name + "-fit"); labelsFit(name + " after keyboard Fit", fit);
    await c.close();
    const recovery = await context({ width, height }), f = await recovery.newPage();
    await f.route("**esm.sh**", r => r.abort()); await f.goto(origin + DEMO_PATH);
    await f.getByTestId("boot-error").waitFor({ state: "visible", timeout: 12000 });
    const error = await capture(f, name + "-error");
    check(name + " CDN failure is explicit without false graph", !error.ready && !error.stageVisible && await f.getByTestId("boot-retry").isVisible() && !(await f.locator("#caption").isVisible()));
    await f.unroute("**esm.sh**"); await f.getByTestId("boot-retry").focus(); await f.keyboard.press("Enter"); await ready(f);
    const retried = await capture(f, name + "-retry"); check(name + " keyboard retry recovers fresh passive fixture", retried.ready && retried.nodes.length === 3 && retried.edges.length === 0);
    await recovery.close();
  }
  const c = await context({ width: 320, height: 800 }), p = await c.newPage();
  await p.goto(origin + DEMO_PATH); await ready(p); labelsFit("320px reflow", await capture(p, "reflow-320"));
  // A reviewer must not accept labels left over from a prior rendered frame.
  // Clear the actual fixture's label canvas, observe synchronously before redraw,
  // then use the real Fit control below to verify a complete current frame again.
  const clearedFrame = await p.evaluate(() => {
    const expected = window.__graphRail.session.getSnapshot().nodes.map(n => n.label);
    const before = { ...window.__labelDraws }, frameBefore = window.__labelFrameId;
    const canvas = document.querySelector("canvas.sigma-labels");
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    return { expected, before, after: { ...window.__labelDraws }, frameBefore, frameAfter: window.__labelFrameId };
  });
  check("cleared real frame cannot be certified by prior fixture labels", clearedFrame.expected.length === 3
    && clearedFrame.expected.every(label => clearedFrame.before[label])
    && Object.keys(clearedFrame.after).length === 0 && clearedFrame.frameAfter === clearedFrame.frameBefore + 1, clearedFrame);
  await p.getByTestId("nodegraph-fit").focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(300); labelsFit("320px keyboard Fit", await capture(p, "reflow-320-fit"));
  await p.setViewportSize({ width: 390, height: 844 }); await p.reload(); await ready(p);
  await p.evaluate(() => {
    const es = [...document.querySelectorAll("h1,h2,h3,p,span,strong,button,code,#log,.suggestion,.state,a")];
    const sizes = es.map(e => getComputedStyle(e).fontSize);
    es.forEach((e,i) => e.style.setProperty("font-size", parseFloat(sizes[i]) * 2 + "px", "important"));
  });
  await p.getByRole("link", { name: "Review suggestions" }).click(); await p.keyboard.press("Tab");
  check("200% DOM text enlargement retains decision route", await p.getByTestId("confirm-suggestion").first().evaluate(e => document.activeElement === e));
  await capture(p, "text-200pct-390"); await c.close();
  const stress = await context({ width: 1440, height: 960 }), s = await stress.newPage();
  await s.goto(origin + DEMO_PATH); await ready(s);
  await s.getByTestId("confirm-suggestion").first().dblclick();
  check("rapid double-confirm creates one edge", (await state(s)).edges.length === 1);
  while (await s.getByTestId("dismiss-suggestion").count()) await s.getByTestId("dismiss-suggestion").first().click();
  await capture(s, "all-resolved");
  for (let elapsed = 0; elapsed <= 60; elapsed += 15) {
    if (elapsed) await s.waitForTimeout(15000);
    const o = await state(s); report.sustained.push({ elapsed, nodes: o.nodes.length, edges: o.edges.length, rows: o.logRows, resolved: o.resolved.length });
    console.log("sustained " + elapsed + "s");
  }
  check("60-second resolved state does not accumulate", report.sustained.every(x => x.nodes === 4 && x.edges === 1 && x.rows === report.sustained[0].rows && x.resolved === 3), report.sustained);
  await s.reload(); await ready(s); const reset = await capture(s, "reload-reset");
  check("reload resets exactly as disclosed", reset.edges.length === 0 && reset.nodes.length === 3 && reset.resolved.length === 0 && /until you reload/.test(reset.disclosure));
  // Chromium's implicit scroll-region focus is reached by real sequential Tab;
  // element.focus() is not equivalent for this existing tabindex-less region.
  for (let i = 0; i < 6 && (await state(s)).active.id !== "log"; i++) await s.keyboard.press("Tab");
  const logReached = (await state(s)).active.id === "log";
  await s.keyboard.press("End");
  await s.waitForFunction(() => { const e = document.querySelector("#log"); return e.scrollTop >= e.scrollHeight - e.clientHeight - 1; });
  const end = await s.locator("#log").evaluate(e => e.scrollTop);
  await s.keyboard.press("Home");
  await s.waitForFunction(() => document.querySelector("#log").scrollTop === 0);
  const home = await s.locator("#log").evaluate(e => e.scrollTop);
  check("existing Chromium log Tab/Home/End behavior remains working", logReached && end > 0 && home === 0, { logReached, end, home, note: "Manual behavior, not a claim that the existing axe portability flag is fixed." });
  await stress.close();
  report.sourceAfter = await sourceHashes();
  check("source unchanged throughout proof", JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter));
} catch (error) {
  report.error = String(error.stack ?? error); check("runner completed", false, report.error);
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(r => server.close(r));
  report.finishedAt = new Date().toISOString(); report.passed = report.checks.every(c => c.passed);
  report.limitations = ["Fixed fixture only; no provider, persistent user data or production claim.", "Viewport and DOM text enlargement are not physical devices or actual browser zoom.", "Whole-dimension and human usability grades remain open.", "The existing axe log-focus flag is reported separately from demonstrated Chromium keyboard access."];
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ out, passed: report.passed, checks: report.checks.length, cells: report.cells.length }));
  if (!report.passed) process.exitCode = 1;
}
