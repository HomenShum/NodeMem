# Promotion log — NodeMem

Loop state lives here, in git, so any agent can resume cold. One entry per
iteration. Append; never rewrite history, because the list of things that turned
out to be wrong is more useful to the next reader than the current values alone.

Iteration cap: **10** (default). On reaching the cap without a gate pass, stop
and leave the remaining defect ledger below — a documented stop is a valid
outcome; a silent one is not.

## Entry shape

```
### Iteration N — YYYY-MM-DD
- Journey exercised: J<k> <name>
- Observed: <the defect, with its reproduction — inputs, width, state>
- Fixed: <the change, using existing components; file paths>
- Re-proved: <evidence path showing the defect gone in the rendered app>
- Tests: <command and result>
- Conditions newly PASS: <numbers, or "none">
```

---

## Baseline — 2026-08-13

Wave 1. Measurement only — **nothing in the product was changed or fixed**, by
design, so Wave 2 has a starting line it can be compared against. Commit
`ac8e7db`, fresh `--depth 50` clone, Node v22.22.2, npm 10, Playwright
Chromium, Windows 11. This repo was **not** marked DEFERRED in the wave brief;
the note carried was "memory library; `countNoteworthyForEntity` is not plumbed
(known API gap)" — confirmed below as D5.

- **App started:** partly. There is no single start command that works.
  - `npm install` → exit 0, 57 packages, ~1m.
  - The documented browser surface has **no npm script**. The README says
    `node scripts/capture-graph-rail.mjs`, which serves the repo on an
    ephemeral port *inside a headless run* and exits — it is a capture gate,
    not a way to open the page.
  - `npm run dev` — the command `nodekit.yaml` declares as this repo's service
    entry (`commands.dev: { script: dev, mode: service }`) — **does not serve
    the app**. See D3.
  - What actually worked for hands-on driving: a hand-rolled static file server
    over the repo root at `127.0.0.1:4894`, then
    `/demo/graph-rail/index.html`. That is the only way a human opens this
    page today.
- **Journeys drivable:** **4.5 of 5.** J1, J2, J3 fully drivable in the
  terminal (exit 0 each). J4 fully drivable in a real browser once served by
  hand. J5 half — the terminal half proven via `npm run demo` Step 4; the
  Dismiss click in the rail was not driven this wave.
- **Commands run, with real exit codes:**

  | command | exit | note |
  |---|---|---|
  | `git clone --depth 50` | 0 | |
  | `node demo/runNodeMemDemo.mjs` | 0 | `Pass: 6  Fail: 0` — no install needed, as advertised |
  | `npm install --no-audit --no-fund` | 0 | 57 packages in ~1m |
  | `npm test` | 0 | 27 passed / 2 files |
  | `npm run typecheck` | 0 | |
  | `npm run build` | 0 | identical to typecheck — `tsc --noEmit`, produces no artifact |
  | `npm run demo` | 0 | `Pass=13 Fail=0 Total=13` |
  | `npm run nodemem:smoke` | 0 | `PASS (13/13)` |
  | `npm run nodemem:in-memory:smoke` | 0 | `PASS (10/10)` |
  | `npm run nodemem:convex:smoke` | 0 | `PASS (7/7)` |
  | `npm run check` (= prepush) | 0 | secret-scan + 2 smokes + typecheck + tests |
  | `node scripts/capture-graph-rail.mjs` | 0 | 5/5 honesty checks; overwrote `assets/graph-rail/*.png` — **not committed** |
  | `npm run dev` | 124 (timeout kill) | server starts, but `GET /` → 404 and `GET /vendor/nodegraph-live/NodeGraph.js` → 500. See D3 |
  | Playwright sweep over `demo/graph-rail/index.html` | 0 | screenshots in `evidence/` |

- **Scorecard at baseline:** 4/12 PASS — see [PRODUCT_GOAL.md](PRODUCT_GOAL.md).
  PASS: 1, 9, 10, 11. FAIL: 2, 3, 4, 5, 6. UNVERIFIED: 7 (no Web Interface
  Guidelines pass run), 8 (no Lighthouse/CWV audit run), 12 (baseline wave made
  no improvements, so no improvement has been verified in the rendered app).
  **This claim was corrected the same day — condition 1 is UNVERIFIED, not
  PASS, and the score is 3/12. See § *Correction — 2026-08-13* below.**

## Defect ledger

Open defects, most-impactful first. A defect is only listed once it has a
reproduction; a hunch is not a defect. Wave 1 fixed none of them; the Status
column is what later waves updated.

| # | Severity | Journey | Reproduction | Status |
|---|----------|---------|--------------|--------|
| D1 | Major | J4 | Serve repo root; open `/demo/graph-rail/index.html` at viewport width 375×812 and load fresh. `#layout` computes `grid-template-columns: 380px 114.281px` (no media query exists in the file), `document.scrollWidth` 567 vs `clientWidth` 375 — 192px of horizontal overflow; the graph pane, the entire point of the page, is 114px wide and off-screen. Reproduces at 390 (177px over) and 320 (247px over); clean at 768, 1024, 1400. `evidence/mobile-375-fresh.png` | open |
| D2 | Major | J4 / Recovery | Load the same page with all `**esm.sh**` requests aborted (any network that blocks the CDN in the `<head>` importmap: react, react-dom, graphology, sigma, @sigma/node-border). Result after 4s: log has 0 children, 0 suggestion cards, 0 `<canvas>`, **0 page errors** — and the caption still describes a graph that is not there. Regex `/error\|failed\|retry\|offline\|could not/i` over `body.innerText` → false. The user sees a blank frame with confident prose and no way back. `evidence/cdn-blocked-no-error-state.png`. **Corrected 2026-08-13:** this entry originally also claimed *0 console errors*. An independent re-run reproduced every user-facing figure above but observed **2 console errors** (the blocked module fetches). The defect is unchanged — nothing reaches the user either way — but "silent" means silent *on screen*, not silent in the console, and the 0 is wrong. | **fixed — Iteration 1** |
| D3 | Major | J4 | `npm run dev` — declared in `nodekit.yaml` as `commands.dev: { script: dev, mode: service }` — runs `vite` over a repo with **no root `index.html`** and with react/sigma/graphology present only in the browser importmap, never in `package.json`. Measured: `GET http://localhost:5999/` → **404**; `GET /vendor/nodegraph-live/NodeGraph.js` → **500** ("Failed to resolve import … Are they installed?"). Also note `vite` itself is not a declared dependency — it resolves only transitively through `vitest`. A stranger following the standard verb gets nothing. | **fixed — Wave 3** |
| D4 | Major | J1 / install | `package.json` declares `"bin": { "nodemem": "./bin/nodemem.mjs" }`. `fs.existsSync('./bin/nodemem.mjs')` → **false**; there is no `bin/` directory in the repo at `ac8e7db`. Any `npm i -g nodemem` / `npx nodemem` creates a broken shim. | **fixed — Wave 3** |
| D5 | Minor | J4 | A store method the docs specify does not exist. `countNoteworthyForEntity` (`docs/GRAPH_INTEGRATION.md:123`) specifies `countNoteworthyForEntity(roomId, entityKey): Promise<number>` on `DedupStore`; `grep -rn countNoteworthyForEntity src/` → **no match**. The data exists (`listNoteworthy` + `NoteworthyRow.entityNames`, now in `src/core/ports.ts`, rows held in `src/adapters/inMemoryAdapter.ts`) and `EntityRef.count` in `vendor/nodegraph-live/session.d.ts` is waiting for it — the method was simply never added. **What is *not* the defect: the rail showing every node as uncounted.** Nothing measures those counts yet, so an uncounted node is the honest render — the page says so (`"unknown — not measured"` (`demo/graph-rail/index.html:85`)) and the browser gate fails the build if any node arrives counted (`every noticed entity is unmeasured` (`scripts/capture-graph-rail.mjs:53`)). Implementing the method adds a *measured* count; it does not make today's page a lie. | open |
| D6 | Minor | J4 / a11y | On the loaded rail: 8 `<canvas>` elements, **0** carrying `aria-label`, `role`, or text content; **0** elements with `aria-live`/`role=status`/`role=log` despite the activity log appending rows asynchronously. Keyboard itself is fine (Confirm reachable in 2 Tabs, visible focus ring, Enter works). A screen-reader user gets the headings and nothing else. | open |

## Iterations

### Iteration 1 — 2026-08-13 — D2, the silent CDN failure

- **Journey exercised:** J4 (open the rail in a browser and watch the pipeline)
  and its recovery path, on `2c76123`, Node v22.22.2, Playwright Chromium,
  Windows 11.
- **Observed (reproduced before touching anything):** with `**esm.sh**`
  requests aborted, `demo/graph-rail/index.html` renders its headings, its
  confident sub-heading and its caption over three empty containers — 0 log
  rows, 0 suggestion cards, 0 `<canvas>`, no error text, no way back. The
  reproduction is now executable: phase 2 of `scripts/capture-graph-rail.mjs`,
  run against the unfixed page, printed **6 failing checks and exited 1**
  (confirmed twice — once before the fix was written, once by stashing only
  `demo/graph-rail/{index.html,main.js}` with the producer left in place).
- **Root cause** — the module tag `id="rail-module"`
  (`demo/graph-rail/index.html:94`), and it is structural, not
  cosmetic. Every pixel of feedback on this page is produced by one
  `<script type="module">` whose import graph resolves through the importmap to
  `esm.sh`. Per the HTML module spec, if any module in that graph fails to
  fetch, the script body **never executes at all**. The page's only logging
  function (`log()` in `main.js`) lives inside that module. So the single code
  path that could report the failure is the code path that failed, and nothing
  outside the module ever observed the boot. The blank frame was not a missing
  error message — it was an error reporter that cannot run in the one situation
  it exists for.
- **Fixed** — the guard now lives where it can always run:
  - `demo/graph-rail/index.html` — a `role="alert"` panel
    (`[data-testid="boot-error"]`, reusing the existing `.suggestion` card
    styling, no new component) plus a **classic** inline script after the module
    tag. It fails fast on the module element's `error` event and, as a
    backstop, on an 8s watchdog that catches the silent variants the error event
    misses — a hang, an importmap miss, a throw during evaluation. All four
    leave `window.__graphRail` unset, so one sentinel covers them. On failure it
    names the cause, hides `#stage` and the caption that describes a graph that
    is not there, and offers two recovery paths: a Retry button and the
    no-CDN, no-install terminal fallback `node demo/runNodeMemDemo.mjs`.
  - A designed **loading** state (`#boot-status`, "fetching React, graphology
    and sigma from esm.sh…") so the seconds before the verdict are not the same
    blank frame in miniature. `demo/graph-rail/main.js` removes it in one line
    once the imports resolve.
- **Re-proved in the rendered app:** `node scripts/capture-graph-rail.mjs` →
  **12/12 checks, exit 0**, up from 5 checks. The seven new ones assert the
  alert is *visible*, carries `role="alert"`, names `esm.sh`, offers a control,
  makes `body.innerText` match the ledger's own
  `/error|failed|retry|offline|could not/i` probe, hides the caption — and that
  **Retry actually recovers**, because a button that does not recover is
  decoration. Evidence:
  `promotion/evidence/cdn-blocked-error-state.png` (the legible failure) and
  `promotion/evidence/cdn-blocked-after-retry.png` (same page, recovered, 3
  entities and 3 suggestion cards). The baseline
  `promotion/evidence/cdn-blocked-no-error-state.png` is the before.
- **Tests:** `npm test` → 27/27 exit 0. `npm run build` (`tsc --noEmit`) → exit
  0. `npm run check` (secret-scan + 2 smokes + typecheck + tests) → exit 0.
  `node scripts/capture-graph-rail.mjs` → 12/12 exit 0.
- **Regression check:** phase 2 of `scripts/capture-graph-rail.mjs`. If the
  boot guard is removed or the alert stops rendering, it exits 1. **Confirmed
  failing on the pre-fix tree** by `git stash push -- demo/graph-rail/*` with
  the producer left in place: 6 ✗, exit 1.
- **Conditions newly PASS:** 5 (error state now exists and is designed) and 12
  (an improvement verified in the rendered app, with a producer that fails
  without it). **3/12 → 5/12.**
- **Not fixed, deliberately — one defect per iteration:** D1 (mobile overflow),
  D3 (`npm run dev` 404/500), D4 (missing `bin/nodemem.mjs`), D5, D6 stay open,
  so condition 2 stays FAIL. Disclosed residual on condition 5: when boot
  fails, the "Activity stream" and "Suggestions" headings still stand over
  empty containers. They are no longer unexplained — the alert directly above
  them says no log, no suggestions and no graph can appear — but they are not
  separately designed empty states.

## Correction — 2026-08-13

An adversarial re-run of the baseline claims against this repo could confirm
only three of the four PASS rows. Both corrections below are recorded rather
than silently swapped in, because the useful thing for the next agent is the
original claim next to what was wrong with it. **No product code was touched;
this is a scorecard-truth correction, not Wave 2.**

**Scorecard: 4/12 PASS → 3/12 PASS.**

- **Condition 1 — "each canonical journey succeeds end-to-end in a real
  browser": PASS → UNVERIFIED.** The row cited J1–J4 and never mentioned J5.
  The shortfall was disclosed in the sibling files — `PRODUCT_JOURNEYS.md` J5
  says the browser half was "not captured … Treat J5 as partially drivable",
  and the baseline above says "Journeys drivable: **4.5 of 5**" — but it was
  not disclosed at the place the condition is scored, and a row that scores
  "each journey" on four of five journeys is overreach. Confirmed while
  correcting: no committed producer drives the J5 Dismiss click at all —
  `scripts/capture-graph-rail.mjs` clicks Confirm only, and
  `[data-testid="dismiss-suggestion"]` appears nowhere outside
  `demo/graph-rail/main.js` — so the row cannot be rescued by re-citing
  existing tooling. It needs the click to actually be driven.
  Separately, and under the gate's amended artifact rule ("if you measured it
  but did not retain the tool, the row is UNVERIFIED"): the J4 screenshots in
  `evidence/` are committed but the Playwright sweep that produced them was
  not, so they are outputs without a producer. J4's central assertion does
  survive that rule — `node scripts/capture-graph-rail.mjs` is committed,
  re-runnable from a fresh clone, and exits 0 with 5/5 checks — and the row now
  cites it instead.
- **Defect ledger D2 — "0 console errors" was wrong; the defect stands.** A
  re-run with `esm.sh` blocked reproduced every user-facing figure exactly
  (0 log children, 0 suggestion cards, 0 `<canvas>`, no error/failed/retry/
  offline/could-not text, 0 page errors) but observed **2 console errors**, not
  0. D2 stays open and stays Major: a blank frame under confident prose with no
  recovery path is the defect, and two console lines the user never sees do not
  soften it. The figure was simply mis-recorded.

Unchanged: conditions 9, 10 and 11 remain PASS; 2, 3, 4, 5 and 6 remain FAIL;
7, 8 and 12 remain UNVERIFIED.

## Wave 3 — 2026-08-13 — human-readiness (structure, not features)

The second loop, run against the [HUMAN-READY gate](https://raw.githubusercontent.com/HomenShum/NodeKit/main/templates/promotion/HUMAN_READY.md):
can a stranger run, trace, change and explain this without the person who built
it. Measurements and every unresolved finding are in
[`docs/SIMPLIFICATION_REPORT.md`](../docs/SIMPLIFICATION_REPORT.md); the ordered
walkthrough is [`docs/START_HERE.md`](../docs/START_HERE.md).

**Two ledger defects closed, both by deletion:**

- **D3 — `npm run dev` does not serve the app: fixed.** Root cause was not the
  missing `index.html`; it was that `dev` invoked `vite`, which nothing in
  `package.json` installs — it resolved only because vitest happens to ship it.
  Meanwhile the repository already contained a working static server, twice,
  copy-pasted into the two capture scripts. Both now import
  `scripts/serve.mjs`, and `dev` runs it. Measured on this tree by running both
  commands against the same clone, not quoted from the Wave 1 baseline:
  `GET /vendor/nodegraph-live/NodeGraph.js` **500 to 200**; `GET /` 404 to 404
  (there is no root page — `dev` now prints the URL that exists);
  `GET /demo/graph-rail/index.html` 200 either way; `GET /../../../etc/passwd`
  404. The row that broke the page is the middle one: under vite the page loaded
  and rendered nothing, because the renderer it imports never arrived. Regression guard: `tests/packageContract.test.ts`
  fails with `` `vite` is in a script but no declared dependency provides it ``
  if the old script is restored — confirmed by restoring it.
- **D4 — `bin` points at a file that does not exist: fixed by deleting the
  claim.** `bin/nodemem.mjs` was never written; writing a CLI to satisfy a stray
  line of JSON would have been the wrong repair. The same test now fails on any
  `bin` target that is missing.

**One defect found by this wave, not previously in the ledger:**

- **D7 — the demo's classifier had drifted from the library's.** Severity: major.
  Reproduction: `classifyNoteworthy("The Next Series will be announced")` returns
  no entity and score 0.36 from `src/core/classifier.ts`, but an entity named
  "The Next Series" and score 0.54 from `demo/nodeMemDemoCore.mjs` — the copy was
  missing the rule that a candidate's first word must not be a stop name. The
  page renders the claim "same classifier … imported, not re-implemented" while
  running the copy. **Fixed**, and bound by `tests/demoMirror.test.ts`, which
  compares whole findings across ten texts. Status: **fixed — Wave 3**.

**Note for anyone following an older entry:** `src/core/dedup.ts` and
`src/core/dismissalLearner.ts` no longer exist. Their port interfaces are in
`src/core/ports.ts` (all of them, in one file); `findExistingNoteworthyForEntity`
moved into `src/core/scanOrchestrator.ts` beside its only caller. D5's data
sources are unchanged, just relocated: `listNoteworthy` and
`NoteworthyRow.entityNames` are now in `src/core/ports.ts`.

**Verification run on this tree:** `npm run typecheck` exit 0; `npm test`
**51 passed** (was 27); `npm run proof` 13/13 exit 0; `npm run capture` **12/12
exit 0**; `node demo/runNodeMemDemo.mjs` 6/6 exit 0. Screenshots were regenerated
by the capture gate and byte-restored afterwards — this wave changed no pixels,
and evidence from a structural refactor that claims new images would be a lie.

**Still open:** D1 (mobile overflow), D5 (`countNoteworthyForEntity` never
implemented), D6 (canvas accessibility). All three are product defects; Wave 3
was structural and did not mix feature work into it.

## Wave 3b — 2026-08-13 — what a cold reader found in the documents

An engineer given only this repository ran it, traced the nine steps of
[`docs/START_HERE.md`](../docs/START_HERE.md), and reported three things the
tree contradicted. All three were true.

- **"The seven gates, one test per reason" described five.**
  `tests/scanOrchestrator.test.ts` asserted `policy_off`, `room_quota_exceeded`,
  `duplicate_entity` and `previously_dismissed`; the first gate (the classifier
  said ignore), `signal_disabled_by_policy` and `not_on_watchlist` had no test
  at all. Three tests added, so the sentence is now true — and one more asserts
  it stays true: it reads every `settle("not_noteworthy", …)` literal out of
  `scanActivity` (`src/core/scanOrchestrator.ts:101`) and fails if any reason
  has no test. A new gate can no longer arrive without one.
- **D5 said the rail was broken; the build gate said the same behavior was
  required.** The gate is right. Nothing in NodeMem measures a per-entity count
  yet, so a node drawn as counted would be a lie — which is why
  `every noticed entity is unmeasured` (`scripts/capture-graph-rail.mjs:53`)
  fails the build if one arrives. The defect is only the specified-but-absent
  store method; D5 now says that and nothing more.
- **"47 tests" in two documents, against a tree with more.** Every stated suite
  size is now "N test files", derived from the same directory read the suite
  runs on, and `tests/docs.test.ts` fails when a document disagrees with the
  tree.

**The citation guard proved anchor stability, not anchor correctness.**
`tests/tours.test.ts` checked that a step's line number was in range and not
blank. Every line in a file is in range, so it passed while a step pointed at
the wrong symbol — and one did: step 2 of tour 1 cited the line closing a
docblock, one above the `DEMO_EVENTS` array it claimed to show. Documents had
the same hole with no check at all: four of the five `path:line` citations in
`NODE-LOOPS.md` pointed at comment text or the wrong file.

Every step now carries the `symbol` it is about and every document citation is
written `` `symbol` (`path:line`) ``; both guards assert the cited line contains
it, and `tests/docs.test.ts` fails on a citation written any other way, so one
cannot be added outside the check.

- **Proof the hardened guards fail on a wrong anchor:** step 3 of tour 1, which
  cites `export function classifyNoteworthy` (`src/core/classifier.ts:108`), was
  repointed one line up, and the START_HERE citation of `scanActivity`
  (`src/core/scanOrchestrator.ts:101`) likewise — both then land on a real,
  non-blank line one above the symbol they name. Hardened: 2 failed ("cited line does not contain
  …; it is ` */`"). The previous guard, restored from `HEAD` and run against
  that same mutated tree: **4 passed**. Both mutations reverted.
- **Measured on this tree, after the changes:** `npm test` **77 passed, 8 test
  files** (was 51 in 7), 1.4s warm / 2.6s cold; `npm run check` exit 0;
  `npm run proof` 13/13; `npm run capture` **12/12 exit 0** — including the
  uncounted-node check that decided D5. Screenshots were regenerated by the
  capture gate and byte-restored: this wave changed no pixels.
- **Not fixed:** D1, D5, D6 stay open. D3 and D4 were closed by Wave 3 and their
  ledger rows still said `open`; the rows now agree with the Wave 3 entry above.
