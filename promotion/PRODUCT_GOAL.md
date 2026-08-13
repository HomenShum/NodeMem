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

| # | Condition | Status | Evidence / reason |
|---|-----------|--------|-------------------|
| 1 | Journeys succeed end-to-end in a real browser | UNVERIFIED | Condition 1 says **each** journey; **J5's browser half was never driven**. The `[data-testid="dismiss-suggestion"]` click was not exercised this wave and no committed producer drives it — `scripts/capture-graph-rail.mjs` clicks Confirm only, and the testid appears nowhere outside `demo/graph-rail/main.js`. Journeys drivable: 4.5 of 5 (see [PRODUCT_JOURNEYS.md](PRODUCT_JOURNEYS.md) J5). What *is* retained: J1/J2/J3 exit 0 (`node demo/runNodeMemDemo.mjs`, `npm run demo`, `npm test`) and J4's honesty assertion has a committed, re-runnable producer — `node scripts/capture-graph-rail.mjs` → 12/12, exit 0 (0 edges before confirmation, exactly 1 traversal edge after; plus the 7 recovery checks added in Iteration 1). Still UNVERIFIED, not PASS: Iteration 1 did not touch J5, and the Dismiss click is still undriven. The J4 screenshots `evidence/desktop-1400-loaded.png` / `evidence/desktop-after-keyboard-confirm.png` are committed but came from an ad-hoc sweep: measured 3 entities, 0 edges before confirmation, 3 suggestion cards at 1400×860, probe not retained |
| 2 | No critical or major usability defect open | FAIL | 3 open, down from 4 — D2 fixed in Iteration 1. Still open, all with reproductions in [PROMOTION_LOG.md](PROMOTION_LOG.md): D1 mobile overflow, D3 `npm run dev` serves 404/500, D4 declared `bin/nodemem.mjs` does not exist |
| 3 | Mobile and desktop both intentional | FAIL | `#layout` is `grid-template-columns: 380px 1fr` with zero media queries. Measured at a fresh 375px load: computed columns `380px 114.281px` — the graph pane is squeezed to 114px and pushed off-screen. `evidence/mobile-375-fresh.png` |
| 4 | No horizontal overflow at supported widths | FAIL | `scrollWidth` vs `clientWidth`: 1400→none, 1024→none, 768→none, **390→567/390 (177px over)**, **375→567/375 (192px over)**, **320→567/320 (247px over)**. `evidence/mobile-375.png` |
| 5 | Loading/empty/success/error/agent-running designed | PASS | Fixed in Iteration 1. Running and success were already designed (per-event pipeline log, suggestion cards, resolved state). Now **loading** is designed (`#boot-status`, "fetching React, graphology and sigma from esm.sh…") and so is **error**: with `**esm.sh**` aborted the page renders a `role="alert"` panel that names the cause, hides the caption describing a graph that is not there, and offers Retry plus the no-CDN fallback `node demo/runNodeMemDemo.mjs`. The ledger's own probe `/error\|failed\|retry\|offline\|could not/i` over `body.innerText` is now **true**. Producer: `node scripts/capture-graph-rail.mjs` phase 2 → 7/7, exit 0, and exits 1 on the pre-fix page. Output: `evidence/cdn-blocked-error-state.png`; recovery proven in `evidence/cdn-blocked-after-retry.png`. Before: `evidence/cdn-blocked-no-error-state.png`. Residual, disclosed not hidden: on failure the "Activity stream" and "Suggestions" headings still stand over empty containers — explained by the alert directly above them, but not separately designed empty states |
| 6 | Keyboard and basic accessibility pass | FAIL | Keyboard half passes: Confirm is reachable in 2 Tab presses, focus ring visible (`outline: auto 1px`), Enter drew the edge (`edges=1`). `evidence/keyboard-focus-confirm.png`. Basic a11y does not: 8 `<canvas>` elements, **0** with any accessible name/role, and **0** live regions for a log that streams asynchronously — a screen-reader user gets nothing from the primary output surface |
| 7 | Web Interface Guidelines: no major unresolved | UNVERIFIED | No WIG review pass was run this wave |
| 8 | Web-quality audit: no major unresolved | UNVERIFIED | No Lighthouse / Core Web Vitals audit was run this wave |
| 9 | No unexplained console errors or failed requests | PASS | Full J4 journey instrumented on `console`, `pageerror`, `requestfailed`, and `response >= 400`: **0 console errors, 0 page errors, 0 failed requests**, including the esm.sh CDN fetches |
| 10 | Performance does not obstruct interaction | PASS | `load` 966ms; pipeline complete 1899ms; Confirm → edge rendered inside a 1.5s wait with no blocking. Nothing obstructed interaction at 1400×860 |
| 11 | Tests and build green | PASS | Re-run after Iteration 1: `npm test` → 27/27, exit 0. `npm run build` (`tsc --noEmit`) → exit 0. `npm run check` (secret-scan + 2 smokes + typecheck + tests) → exit 0. `node scripts/capture-graph-rail.mjs` → **12/12** checks, exit 0. Caveat recorded, not scored: `build` compiles nothing — there is no publishable artifact step |
| 12 | Verified in the rendered app, not inferred from code | PASS | Iteration 1's fix was observed in a real browser, not reasoned about: the defect was reproduced first (6 ✗, exit 1), fixed, then re-observed gone (12/12, exit 0), with the producer `scripts/capture-graph-rail.mjs` committed and re-runnable from a fresh clone and its outputs committed at `evidence/cdn-blocked-error-state.png` and `evidence/cdn-blocked-after-retry.png`. The producer was confirmed to fail on the pre-fix tree by stashing only `demo/graph-rail/{index.html,main.js}` |

**Status: NOT PROMOTED** — 5/12 PASS.
