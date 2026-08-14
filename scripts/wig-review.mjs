/**
 * Web Interface Guidelines review of demo/graph-rail — condition 7, executable.
 *
 * A review is a human judgement, but the *evidence* under each judgement must be
 * a number someone else can reproduce. So this script does not score the page.
 * It measures one DOM fact per guideline it checks, at four widths, and writes
 * them to promotion/evidence/audit/wig-review.json next to screenshots. The
 * written review — which finding is major, and why — is promotion/WIG_REVIEW.md,
 * and every measurement it quotes comes from this file's output.
 *
 * Checklist source: https://vercel.com/design/guidelines (fetched 2026-08-13).
 * Only the rules that can apply to this page are checked; the rest are recorded
 * `n/a` with the reason, because a checklist that silently drops rules is how a
 * review gets weakened.
 *
 * This is NOT the Lighthouse/axe audit. Those measure machine-checkable quality
 * (condition 8) and live in scripts/audit-web-quality.mjs. A score from one is
 * not evidence for the other.
 *
 *   node scripts/wig-review.mjs
 *   node scripts/wig-review.mjs --tag=before   # writes wig-review-before.json
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { serveRepo, DEMO_PATH } from "./serve.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "promotion", "evidence", "audit");
mkdirSync(outDir, { recursive: true });

const tagArg = process.argv.find((a) => a.startsWith("--tag="));
const tag = tagArg ? `-${tagArg.slice(6)}` : "";

/**
 * Widths a stranger actually arrives at. 412 is Lighthouse's mobile emulation;
 * 320 is the narrowest width the Wave 1 defect ledger reproduced D1 at, kept so
 * the fix is measured against the original reproduction rather than a subset.
 */
const WIDTHS = [320, 375, 412, 768, 1440];

const findings = [];
/**
 * @param {string} rule - the guideline, quoted from the checklist section it lives in
 * @param {"pass"|"major"|"minor"|"n/a"} verdict
 * @param {string} evidence - the measurement, not an opinion
 */
const record = (rule, verdict, evidence, at) => {
  findings.push({ rule, verdict, evidence, ...(at ? { width: at } : {}) });
  const mark = { pass: "✓", major: "✗ MAJOR", minor: "· minor", "n/a": "–" }[verdict];
  console.log(`  ${mark} ${rule}${at ? ` @${at}` : ""} — ${evidence}`);
};

const { server, origin } = await serveRepo();
const url = `${origin}${DEMO_PATH}`;
const browser = await chromium.launch();

// ---------------------------------------------------------------- per width
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 860 } });
  await page.goto(url);
  await page.waitForFunction(() => window.__graphRail?.pipelineDone === true, null, { timeout: 30000 });
  await page.waitForTimeout(1500);

  const m = await page.evaluate(() => {
    const el = document.documentElement;
    const layout = document.getElementById("layout");
    const cols = getComputedStyle(layout).gridTemplateColumns;
    const stage = document.getElementById("stage");
    // Only controls a finger can reach. The boot-error Retry is 0x0 until the
    // CDN fails; measuring a hidden control as an undersized one is a false hit.
    const buttons = [...document.querySelectorAll("button")]
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { label: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((b) => b.w > 0 && b.h > 0);
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      gridTemplateColumns: cols,
      stageWidth: Math.round(stage.getBoundingClientRect().width),
      buttons,
    };
  });

  const over = m.scrollWidth - m.clientWidth;
  // Layout § "No excessive scrollbars" + "Responsive coverage"
  record(
    "Layout: no horizontal overflow (responsive coverage / no excessive scrollbars)",
    over > 0 ? "major" : "pass",
    `scrollWidth ${m.scrollWidth} vs clientWidth ${m.clientWidth} → ${over > 0 ? `${over}px over` : "no overflow"}`,
    width,
  );
  // Layout § "Responsive coverage" — a pane narrower than its own content is not a layout
  record(
    "Layout: responsive coverage (the primary pane stays usable)",
    m.stageWidth < 240 ? "major" : "pass",
    `#layout columns "${m.gridTemplateColumns}", #stage ${m.stageWidth}px`,
    width,
  );
  // Interactions § "Match visual & hit targets" — ≥24px, 44px on mobile
  const min = width < 768 ? 44 : 24;
  const small = m.buttons.filter((b) => b.h < min || b.w < min);
  record(
    `Interactions: hit targets ≥ ${min}px`,
    small.length ? "minor" : "pass",
    small.length ? `${small.length}/${m.buttons.length} under: ${small.map((b) => `${b.label} ${b.w}x${b.h}`).join(", ")}` : `${m.buttons.length} controls all ≥ ${min}px`,
    width,
  );

  await page.screenshot({ path: join(outDir, `wig${tag}-${width}.png`), fullPage: true });
  await page.close();
}

// ------------------------------------------------------- single-width checks
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
await page.goto(url);
await page.waitForFunction(() => window.__graphRail?.pipelineDone === true, null, { timeout: 30000 });
await page.waitForTimeout(1500);

const head = await page.evaluate(() => {
  const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content ?? null;
  const canvases = [...document.querySelectorAll("canvas")];
  const named = canvases.filter((c) => c.getAttribute("aria-label") || c.getAttribute("role") || c.textContent.trim());
  const stage = document.getElementById("stage");
  return {
    title: document.title,
    description: meta("description"),
    viewport: meta("viewport"),
    themeColor: document.querySelector('meta[name="theme-color"]')?.content ?? null,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    icon: document.querySelector('link[rel~="icon"]')?.getAttribute("href") ?? null,
    preconnect: [...document.querySelectorAll('link[rel="preconnect"],link[rel="dns-prefetch"]')].map((l) => l.href),
    touchAction: getComputedStyle(document.body).touchAction,
    liveRegions: document.querySelectorAll('[aria-live],[role="log"],[role="status"],[role="alert"]').length,
    logIsLive: !!document.getElementById("log").closest('[aria-live],[role="log"]') || !!document.getElementById("log").matches('[aria-live],[role="log"]'),
    canvasCount: canvases.length,
    canvasNamed: named.length,
    stageRole: stage.getAttribute("role"),
    stageLabel: stage.getAttribute("aria-label"),
    headings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => h.tagName),
    skipLink: !!document.querySelector('a[href^="#"]'),
    linksAsButtons: [...document.querySelectorAll("button")].filter((b) => /go to|open |view /i.test(b.textContent)).length,
    straightEllipsis: /\.\.\./.test(document.body.innerText),
    lang: document.documentElement.lang,
  };
});

// Content § "Accurate page titles"
record("Content: accurate page title", head.title.trim() ? "pass" : "major", `<title> "${head.title}"`);
// Content § "Accessible content" — SEO/social description; Lighthouse scores it too
record("Content: document has a meta description", head.description ? "pass" : "minor", head.description ? `"${head.description.slice(0, 60)}…"` : "no meta[name=description]");
// Interactions § "Respect zoom"
record(
  "Interactions: respect zoom (browser zoom not disabled)",
  /user-scalable\s*=\s*no|maximum-scale/.test(head.viewport ?? "") ? "major" : "pass",
  `viewport "${head.viewport}"`,
);
// Design § "Browser UI matches background"
record("Design: browser UI matches background (theme-color)", head.themeColor ? "pass" : "minor", head.themeColor ?? "no meta[name=theme-color]");
// Design § "Set appropriate color-scheme"
record("Design: color-scheme declared", head.colorScheme.includes("dark") ? "pass" : "minor", `color-scheme: ${head.colorScheme}`);
// Performance § "Preconnect to origins" — every module on this page comes from esm.sh
record(
  "Performance: preconnect to origins",
  head.preconnect.some((h) => h.includes("esm.sh")) ? "pass" : "minor",
  head.preconnect.length ? head.preconnect.join(", ") : "no preconnect/dns-prefetch; every module is fetched from esm.sh",
);
// Interactions § "Prevent double-tap zoom"
record("Interactions: touch-action set to prevent double-tap zoom", head.touchAction === "manipulation" ? "pass" : "minor", `body touch-action: ${head.touchAction}`);
// Interactions § "Announce async updates (polite aria-live)"
record(
  "Interactions: async updates are announced",
  head.logIsLive ? "pass" : "major",
  head.logIsLive ? "#log is a live region" : `#log streams rows with no aria-live/role=log (page has ${head.liveRegions} live region(s), all elsewhere)`,
);
// Content § "Accessible content: hide decoration, verify tree"
record(
  "Content: the canvas output surface has an accessible name",
  // "img" would also name it, but it makes children presentational and this box
  // holds NodeGraph's fit/filter controls — axe calls that nested-interactive.
  head.canvasNamed || (head.stageRole === "figure" && head.stageLabel) ? "pass" : "major",
  `${head.canvasCount} <canvas>, ${head.canvasNamed} named; #stage role=${head.stageRole ?? "none"} aria-label=${head.stageLabel ? "set" : "none"}`,
);
// Content § "Headings & skip link"
const order = head.headings.join(">");
record("Content: heading hierarchy", /^H1(>H2)+$/.test(order) ? "pass" : "minor", `headings ${order}`);
record("Content: skip link", head.skipLink ? "pass" : "minor", head.skipLink ? "in-page link present" : "no skip link (single-screen page, no long nav to skip)");
// Content § "Use the ellipsis character"
record("Content: ellipsis character", head.straightEllipsis ? "minor" : "pass", head.straightEllipsis ? "found '...' in rendered text" : "no '...' in rendered text");
// Interactions § "Links are links"
record("Interactions: links are links", head.linksAsButtons === 0 ? "pass" : "minor", `${head.linksAsButtons} navigation-shaped <button>`);
// Content § "Accessible content" — language
record("Content: document language", head.lang ? "pass" : "minor", `lang="${head.lang}"`);

// Interactions § "Keyboard works everywhere" + "Clear focus"
const kbd = await page.evaluate(async () => {
  const first = document.querySelector('[data-testid="confirm-suggestion"]');
  first.focus();
  const s = getComputedStyle(first);
  const focusable = document.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  return {
    focused: document.activeElement === first,
    outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`,
    focusableCount: focusable.length,
    reachable: [...focusable].every((el) => el.tabIndex >= 0 && !el.hasAttribute("disabled")),
  };
});
record("Interactions: keyboard works everywhere", kbd.reachable ? "pass" : "major", `${kbd.focusableCount} focusable controls, all tabbable`);
record("Interactions: clear focus", kbd.outline.startsWith("none") ? "major" : "pass", `focused Confirm outline: ${kbd.outline}`);

// Animations § "Honor prefers-reduced-motion"
await page.close();
const reduced = await browser.newPage({ viewport: { width: 1440, height: 860 }, reducedMotion: "reduce" });
await reduced.goto(url);
const settled = await reduced
  .waitForFunction(() => window.__graphRail?.pipelineDone === true, null, { timeout: 30000 })
  .then(() => true)
  .catch(() => false);
const rm = await reduced.evaluate(() => ({
  nodes: window.__graphRail?.session.getSnapshot().nodes.length ?? 0,
  honored: matchMedia("(prefers-reduced-motion: reduce)").matches,
}));
record(
  "Animations: honor prefers-reduced-motion",
  settled && rm.nodes > 0 ? "minor" : "major",
  settled
    ? `page renders under prefers-reduced-motion (${rm.nodes} nodes, media query ${rm.honored}); the sigma force layout still animates — no reduced variant is branched`
    : "page did not finish under prefers-reduced-motion",
);
await reduced.screenshot({ path: join(outDir, `wig${tag}-reduced-motion.png`), fullPage: true });
await reduced.close();

// -------------------------------------------------- rules that cannot apply
for (const [rule, why] of [
  ["Forms (whole section)", "the page has no form, input, textarea or select"],
  ["Interactions: URL as state / deep-link everything", "single screen, no filters, tabs or pagination to encode"],
  ["Interactions: optimistic updates", "Confirm mutates in-process state only; there is no server round trip to be optimistic about"],
  ["Interactions: confirm destructive actions", "Dismiss is the correction control and is itself non-destructive — it records a dismissal and mutates no graph"],
  ["Content: stable skeletons", "no skeletons; the loading state is a labelled status row (#boot-status)"],
  ["Performance: large lists", "the activity log is bounded by DEMO_EVENTS (6 fixtures)"],
]) {
  record(rule, "n/a", why);
}

await browser.close();
server.close();

const majors = findings.filter((f) => f.verdict === "major");
const report = {
  tool: "scripts/wig-review.mjs",
  checklist: "https://vercel.com/design/guidelines",
  checklistFetched: "2026-08-13",
  url: DEMO_PATH,
  widths: WIDTHS,
  ranAt: new Date().toISOString(),
  counts: {
    pass: findings.filter((f) => f.verdict === "pass").length,
    major: majors.length,
    minor: findings.filter((f) => f.verdict === "minor").length,
    na: findings.filter((f) => f.verdict === "n/a").length,
  },
  findings,
};
writeFileSync(join(outDir, `wig-review${tag}.json`), JSON.stringify(report, null, 2) + "\n");

console.log(`\n  ${report.counts.major} major, ${report.counts.minor} minor, ${report.counts.pass} pass, ${report.counts.na} n/a`);
console.log(`  → promotion/evidence/audit/wig-review${tag}.json`);
console.log(majors.length ? "\n  ✗ WIG REVIEW: majors unresolved" : "\n  ✓ WIG REVIEW: no major unresolved");
process.exit(majors.length ? 1 : 0);
