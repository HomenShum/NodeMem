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

| # | Condition | Status | Evidence / reason |
|---|-----------|--------|-------------------|
| 1 | Journeys succeed end-to-end in a real browser | PASS | J1/J2/J3 exit 0 (`node demo/runNodeMemDemo.mjs`, `npm run demo`, `npm test`); J4 driven in Chromium — 3 entities noticed, **0 edges** before confirmation, 3 suggestions rendered, one Confirm → exactly 1 traversal edge. `evidence/desktop-1400-loaded.png`, `evidence/desktop-after-keyboard-confirm.png` |
| 2 | No critical or major usability defect open | FAIL | 4 open, all with reproductions in [PROMOTION_LOG.md](PROMOTION_LOG.md): D1 mobile overflow, D2 silent failure when the CDN is unreachable, D3 `npm run dev` serves 404/500, D4 declared `bin/nodemem.mjs` does not exist |
| 3 | Mobile and desktop both intentional | FAIL | `#layout` is `grid-template-columns: 380px 1fr` with zero media queries. Measured at a fresh 375px load: computed columns `380px 114.281px` — the graph pane is squeezed to 114px and pushed off-screen. `evidence/mobile-375-fresh.png` |
| 4 | No horizontal overflow at supported widths | FAIL | `scrollWidth` vs `clientWidth`: 1400→none, 1024→none, 768→none, **390→567/390 (177px over)**, **375→567/375 (192px over)**, **320→567/320 (247px over)**. `evidence/mobile-375.png` |
| 5 | Loading/empty/success/error/agent-running designed | FAIL | Running and success states are designed (per-event pipeline log, suggestion cards, resolved state). The **error state does not exist**: with `**esm.sh**` requests aborted, the page renders its headings and a caption describing a graph, then shows an empty log (0 children), 0 suggestions, 0 canvases, and no error text anywhere (`/error\|failed\|retry\|offline/i` → false). Zero page errors, so it fails silently. `evidence/cdn-blocked-no-error-state.png` |
| 6 | Keyboard and basic accessibility pass | FAIL | Keyboard half passes: Confirm is reachable in 2 Tab presses, focus ring visible (`outline: auto 1px`), Enter drew the edge (`edges=1`). `evidence/keyboard-focus-confirm.png`. Basic a11y does not: 8 `<canvas>` elements, **0** with any accessible name/role, and **0** live regions for a log that streams asynchronously — a screen-reader user gets nothing from the primary output surface |
| 7 | Web Interface Guidelines: no major unresolved | UNVERIFIED | No WIG review pass was run this wave |
| 8 | Web-quality audit: no major unresolved | UNVERIFIED | No Lighthouse / Core Web Vitals audit was run this wave |
| 9 | No unexplained console errors or failed requests | PASS | Full J4 journey instrumented on `console`, `pageerror`, `requestfailed`, and `response >= 400`: **0 console errors, 0 page errors, 0 failed requests**, including the esm.sh CDN fetches |
| 10 | Performance does not obstruct interaction | PASS | `load` 966ms; pipeline complete 1899ms; Confirm → edge rendered inside a 1.5s wait with no blocking. Nothing obstructed interaction at 1400×860 |
| 11 | Tests and build green | PASS | `npm test` → 27/27, exit 0. `npm run build` (`tsc --noEmit`) → exit 0. `npm run check` (secret-scan + 2 smokes + typecheck + tests) → exit 0. `node scripts/capture-graph-rail.mjs` → 5/5 checks, exit 0. Caveat recorded, not scored: `build` compiles nothing — there is no publishable artifact step |
| 12 | Verified in the rendered app, not inferred from code | UNVERIFIED | Baseline wave; no improvement was made, so no improvement has been verified. Observations above are rendered-app observations, but condition 12 is about fixes and there are none yet |

**Status: NOT PROMOTED** — 4/12 PASS.
