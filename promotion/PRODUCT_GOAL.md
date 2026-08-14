# Product goal — NodeMem

## Who opens this, and what they are trying to finish

Someone is building a work app where people talk — a deal room, a shared
project chat, a research workspace. Names keep going past in the conversation:
a company a colleague met last week, a hospital running a pilot, a person who
made an introduction. The builder wants the app to notice those names, because
a teammate reading back through three weeks of messages will not. What they are
afraid of is the obvious next step: if the app notices a name and immediately
goes off and researches it, then a busy afternoon of chatter turns into a
hundred background jobs, the same company gets flagged five times, and the
thing a colleague already said "no, drop it" to comes back tomorrow. So they
arrive holding a narrow question — *can I get the noticing without the acting?*
They open this repository, run one command, and want to see for themselves that
a detected name becomes a **suggestion sitting in an inbox** and nothing else
happens until a human clicks. What they walk away holding, if it worked, is a
short answer they trust: a demo they watched suppress a duplicate, suppress a
name someone had dismissed, and refuse to draw a single line on a picture until
a person confirmed it — plus the small piece of code (a classifier, a pipeline,
and one storage interface they can point at their own database) they would drop
into their app tomorrow.

## The gate

This repo is judged by the twelve-condition PROMOTION gate, which lives in one
place and is not restated here:

**https://github.com/HomenShum/NodeKit/blob/main/templates/promotion/GATE.md**

Gate variant: `reduced` <!-- reduced = library/CLI judged on its demo
surface and quickstart; see the GATE's reduced-gate section -->

Scoring vocabulary is PASS / FAIL / **UNVERIFIED**, and UNVERIFIED is never PASS.

## Canonical journeys

The work queue lives in [PRODUCT_JOURNEYS.md](PRODUCT_JOURNEYS.md). A journey
without browser evidence is unfinished, however green the tests are.

## Loop state

Every iteration is recorded in [PROMOTION_LOG.md](PROMOTION_LOG.md) — journey
exercised, defect fixed, evidence path, conditions newly passing. Loop state
lives in git, never in an agent's memory, so any agent can resume the loop cold.

## Current scorecard

Measured 2026-08-13 on `ac8e7db`, Node v22.22.2, Playwright Chromium, Windows 11.
The only browser surface in this repo is `demo/graph-rail/index.html`; it was
served on `127.0.0.1:4894` and driven for real. Screenshots in
[`evidence/`](evidence/).

Corrected 2026-08-13: condition 1 downgraded PASS → UNVERIFIED, 4/12 → 3/12.
The original claim and the reason for the correction are in
[PROMOTION_LOG.md](PROMOTION_LOG.md) § *Correction — 2026-08-13*.

Iteration 1, 2026-08-13, on `2c76123`: D2 fixed — 3/12 → **5/12** (conditions 5
and 12). See [PROMOTION_LOG.md](PROMOTION_LOG.md) § *Iteration 1*.

Iteration 2, 2026-08-13, on `d717fcf`: the two audits that had never been run
were run, and D1 and D6 were fixed on their findings — 5/12 → **11/12**
(conditions 2, 3, 4, 6, 7, 8 moved; 9 and 10 re-evidenced with retained
producers). See [PROMOTION_LOG.md](PROMOTION_LOG.md) § *Iteration 2* and
[WIG_REVIEW.md](WIG_REVIEW.md). Every row below that cites a number cites a
committed artifact under [`evidence/audit/`](evidence/audit/) and the committed
script that regenerates it — `npm run audit:web` and `npm run audit:wig`.

| # | Condition | Status | Evidence / reason |
|---|-----------|--------|-------------------|
| 1 | Journeys succeed end-to-end in a real browser | UNVERIFIED | Condition 1 says **each** journey; **J5's browser half was never driven**. The `[data-testid="dismiss-suggestion"]` click was not exercised this wave and no committed producer drives it — `scripts/capture-graph-rail.mjs` clicks Confirm only, and the testid appears nowhere outside `demo/graph-rail/main.js`. Journeys drivable: 4.5 of 5 (see [PRODUCT_JOURNEYS.md](PRODUCT_JOURNEYS.md) J5). What *is* retained: J1/J2/J3 exit 0 (`node demo/runNodeMemDemo.mjs`, `npm run demo`, `npm test`) and J4's honesty assertion has a committed, re-runnable producer — `node scripts/capture-graph-rail.mjs` → 12/12, exit 0 (0 edges before confirmation, exactly 1 traversal edge after; plus the 7 recovery checks added in Iteration 1). Still UNVERIFIED, not PASS: Iteration 1 did not touch J5, and the Dismiss click is still undriven. The J4 screenshots `evidence/desktop-1400-loaded.png` / `evidence/desktop-after-keyboard-confirm.png` are committed but came from an ad-hoc sweep: measured 3 entities, 0 edges before confirmation, 3 suggestion cards at 1400×860, probe not retained |
| 2 | No critical or major usability defect open | PASS | 0 major open. D1 (mobile overflow) fixed in Iteration 2 and re-measured gone at 320/375/412/768/1440; D2 fixed in Iteration 1; D3 and D4 fixed in Wave 3 and re-confirmed on this tree (`npm run dev` serves the rail 200; `package.json` declares no `bin`). D6 (canvas accessibility) closed as part of condition 6. Remaining ledger entries are Minor: D5 (`countNoteworthyForEntity` specified but never implemented) plus the six minor findings disclosed in [WIG_REVIEW.md](WIG_REVIEW.md). Producers: `npm run audit:wig`, which exits 1 while any major stands, and `npm run audit:web` |
| 3 | Mobile and desktop both intentional | PASS | There is now a `max-width: 767px` media query, and both sides were measured rather than assumed. Computed `#layout` columns, and `#stage` width: 320 → `288px`, 288px; 375 → `343px`, 343px; 412 → `380px`, 380px; 768 → `380px 342px`, 342px; 1440 → `380px 846px`, 846px. Before, every width computed `380px 114.281px` with the graph pane at 114px. Producer: `npm run audit:wig`. Output: `evidence/audit/wig-review.json` (after) and `evidence/audit/wig-review-before.json` (before), with a screenshot per width, `evidence/audit/wig-320.png` through `wig-1440.png` |
| 4 | No horizontal overflow at supported widths | PASS | `documentElement.scrollWidth` equals `clientWidth` at 320, 375, 412, 768 and 1440. Before, measured by the same producer on this same tree: 524 vs 320 (204px over), 524 vs 375 (149px over), 524 vs 412 (112px over). Producer: `npm run audit:wig`, which records the pair at every width and calls any overflow major. Output: `evidence/audit/wig-review.json`, `evidence/audit/wig-review-before.json` |
| 5 | Loading/empty/success/error/agent-running designed | PASS | Fixed in Iteration 1. Running and success were already designed (per-event pipeline log, suggestion cards, resolved state). Now **loading** is designed (`#boot-status`, "fetching React, graphology and sigma from esm.sh…") and so is **error**: with `**esm.sh**` aborted the page renders a `role="alert"` panel that names the cause, hides the caption describing a graph that is not there, and offers Retry plus the no-CDN fallback `node demo/runNodeMemDemo.mjs`. The ledger's own probe `/error\|failed\|retry\|offline\|could not/i` over `body.innerText` is now **true**. Producer: `node scripts/capture-graph-rail.mjs` phase 2 → 7/7, exit 0, and exits 1 on the pre-fix page. Output: `evidence/cdn-blocked-error-state.png`; recovery proven in `evidence/cdn-blocked-after-retry.png`. Before: `evidence/cdn-blocked-no-error-state.png`. Residual, disclosed not hidden: on failure the "Activity stream" and "Suggestions" headings still stand over empty containers — explained by the alert directly above them, but not separately designed empty states |
| 6 | Keyboard and basic accessibility pass | PASS | Keyboard was already passing and still is: 8 focusable controls all tabbable, Confirm reachable in 2 Tabs, visible focus ring, Enter draws the edge. `evidence/keyboard-focus-confirm.png`. The accessibility half is what moved. axe-core 4.13.0: **0 violations, 28 rules passed** — before, 1 serious `color-contrast`, the log kind labels at 2.9:1 against a 4.5:1 threshold. Lighthouse accessibility **1.0**, before 0.90. D6 both reproductions closed: the streaming log now carries `role="log" aria-live="polite"`, and the canvas surface carries `role="figure"` with a name. Producers: `npm run audit:web` (gates axe serious and critical at 0, Lighthouse a11y at 0.95) and `npm run audit:wig`. Outputs: `evidence/audit/axe.json`, `evidence/audit/axe-before.json`, `evidence/audit/lighthouse.json`. Residual, disclosed: the 8 `<canvas>` elements are still individually unnamed — the named figure plus the text narration in the live log is the alternative, not a per-canvas label |
| 7 | Web Interface Guidelines: no major unresolved | PASS | A review, not a score — the write-up is [WIG_REVIEW.md](WIG_REVIEW.md), one finding per guideline with the DOM measurement under it. Checklist fetched from <https://vercel.com/design/guidelines> on 2026-08-13; it was reachable and nothing was substituted. **8 major to 0**: three widths of horizontal overflow, three widths with the graph pane at 114px, the log streaming with no live region, and the canvas surface with no accessible name. 6 minor stay open and are named in the write-up. Producer: `npm run audit:wig`, which exits 1 while any major stands — confirmed against the pre-fix page by stashing only `demo/graph-rail/index.html`: 8 major, exit 1. Outputs: `evidence/audit/wig-review.json`, `evidence/audit/wig-review-before.json`, screenshots at five widths, and `evidence/audit/wig-reduced-motion.png` |
| 8 | Web-quality audit: no major unresolved | PASS | `lighthouse@13.4.1` (mobile preset, 4x CPU slowdown) and `@axe-core/cli@4.13.0`, both against the served page. After: accessibility **1.0**, best-practices **1.0**, SEO **1.0**, LCP **1661ms**, CLS **0.000**, 0 browser console errors, axe **0 violations, 28 rules passed**. Before, same producer on the pre-fix tree: accessibility 0.90, best-practices 0.96, SEO 0.90, CLS 0.062, axe 1 serious violation, and a `/favicon.ico` 404 logged to the console on every load. Producer: `npm run audit:web` — it fails on axe serious or critical above 0, Lighthouse a11y or best-practices below 0.95, LCP above 2500ms, CLS above 0.1, or any console error. Outputs: `evidence/audit/lighthouse.json`, `evidence/audit/axe.json`, and the `-before` pair. Residual, disclosed and deliberately **not** gated: the performance score moves between 0.71 and 0.94 across runs (TBT 260ms to 1550ms) because the page evaluates React, sigma and graphology from a CDN under a simulated 4x CPU slowdown. It is written into the receipt every run; pinning a threshold to it would only invite tuning the threshold |
| 9 | No unexplained console errors or failed requests | PASS | Now measured by a retained producer and by two independent tools. Lighthouse `errors-in-console`: **0 items**, and the audit fails the run if that list is non-empty. The Playwright journey stays instrumented on `console`, `pageerror`, `requestfailed` and `response >= 400`: 0 each, including the esm.sh fetches. **Correction to the earlier PASS:** it was true of the probe that made it and not of a real browser. Playwright never requests `/favicon.ico`; Chrome does, and the page declared no icon, so every real load logged a 404 the earlier instrumentation could not see. The page now declares an inline empty icon. Producer: `npm run audit:web`. Output: `evidence/audit/lighthouse.json` |
| 10 | Performance does not obstruct interaction | PASS | Core Web Vitals from the committed receipt: LCP **1661ms**, CLS **0.000**, both inside the good band, under Lighthouse mobile emulation with a 4x CPU slowdown — the pessimistic case, not the desktop one. CLS measured **0.303** mid-iteration when the one-column order was wrong, so the fix is measured rather than asserted. Interaction itself: `npm run capture` clicks Confirm and asserts the traversal edge appears inside a 5s wait, 12/12 checks, exit 0. Disclosed: TBT 260ms to 1550ms across runs under that same 4x throttle, driven by CDN module evaluation. It delays *full* interactivity on a throttled phone, and it is the one performance number this repo cannot fix without abandoning the no-build CDN demo. Producers: `npm run audit:web`, `npm run capture`. Output: `evidence/audit/lighthouse.json` |
| 11 | Tests and build green | PASS | Re-run after Iteration 1: `npm test` → 27/27, exit 0. `npm run build` (`tsc --noEmit`) → exit 0. `npm run check` (secret-scan + 2 smokes + typecheck + tests) → exit 0. `node scripts/capture-graph-rail.mjs` → **12/12** checks, exit 0. Caveat recorded, not scored: `build` compiles nothing — there is no publishable artifact step |
| 12 | Verified in the rendered app, not inferred from code | PASS | Iteration 1's fix was observed in a real browser, not reasoned about: the defect was reproduced first (6 ✗, exit 1), fixed, then re-observed gone (12/12, exit 0), with the producer `scripts/capture-graph-rail.mjs` committed and re-runnable from a fresh clone and its outputs committed at `evidence/cdn-blocked-error-state.png` and `evidence/cdn-blocked-after-retry.png`. The producer was confirmed to fail on the pre-fix tree by stashing only `demo/graph-rail/{index.html,main.js}` |

**Status: NOT PROMOTED** — 11/12 PASS, 1 UNVERIFIED. The one open row is
condition 1: J5's Dismiss click still has no committed producer that drives it.
