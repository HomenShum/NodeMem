# Simplification report — Wave 3

Before is commit `06ef268`; after is this commit. Every number below was produced
by running the command in its row on this machine (Windows 11, Node v22.22.2,
npm 10.9.7), once before any edit and once after. Where a tool does not fit this
stack the row says so instead of being left blank.

The target was **concepts removed**, not lines. Two of the biggest wins add
lines: a test that makes drift impossible, and a working `npm run dev`.

## Measurements

| Measure | Before | After | Change | Evidence command |
|---|---:|---:|---:|---|
| Production files (`src/`) | 10 | 9 | −1 | `git ls-files src \| wc -l` |
| Production source lines (`src/`) | 1065 | 949 | −116 | `git ls-files src \| xargs wc -l \| tail -1` |
| Files a reader must open to learn the storage contract | 4 | 1 | −3 | `grep -rlnE "export interface (Dedup\|Dismissal\|Policy\|Memory)Store" src/` |
| Public names in the barrel | 29 | 28 | −1 | `grep -oE "export (type )?\{[^}]*\}" src/index.ts` |
| npm scripts | 16 | 11 | −5 | `node -e "console.log(Object.keys(require('./package.json').scripts).length)"` |
| Direct dependencies (1 runtime + 5 dev) | 6 | 6 | 0 | `node -e "…Object.keys(deps).length…"` |
| Binaries invoked by scripts that no declared dependency provides | 1 (`vite`) | 0 | −1 | `npm test` → `tests/packageContract.test.ts` |
| All authored files (`src demo scripts tests`) | 25 | 27 | +2 | `git ls-files src demo scripts tests \| wc -l` |
| All authored lines | 2514 | 2372 | −142 | `git ls-files src demo scripts tests \| xargs wc -l \| tail -1` |
| Unused files (knip) | 13 | 12 | −1 | `npx knip@5 --no-config-hints` |
| Unused exports (knip) | 5 | 0 | −5 | `npx knip@5 --no-config-hints` |
| Unused exported types (knip) | 7 | 7 | 0 | `npx knip@5 --no-config-hints` |
| Unused devDependencies (knip) | 1 (`playwright`) | 0 | −1 | `npx knip@5 --no-config-hints` |
| Unlisted binaries (knip) | 1 (`vite`) | 0 | −1 | `npx knip@5 --no-config-hints` |
| Duplicate blocks (jscpd) | 8 | 1 | −7 | `npx jscpd@4 src demo scripts tests --min-lines 5 --min-tokens 50` |
| Duplicate lines / percentage (jscpd) | 101 / 3.77% | 9 / 0.36% | −92 / −3.41pp | same command |
| Circular dependencies | 0 | 0 | 0 | `npx dependency-cruiser@16 --config <no-circular rule> src demo scripts tests` |
| Unit tests | 27 (2 files) | 51 (7 files) | +24 | `npm test` |
| Pipeline proof checks | 13 | 13 | 0 | `npm run proof` |
| Browser workflow checks | 12 pass | 12 pass | 0 | `npm run capture` |
| Typecheck | clean | clean | 0 | `npm run typecheck` |
| `npm run dev` serves a working page | **no** | yes | fixed | see the three status codes below |
| Production bundle size | not applicable — no bundler and no build artifact; `npm run build` was `tsc --noEmit`, which emits nothing | | | `cat tsconfig.json` (`"noEmit": true`) |
| Additions / deletions | — | 42 files, +1762 / −922 | — | `git diff --shortstat 06ef268` |

### The `npm run dev` row, measured both ways

Re-measured on this tree rather than quoted from the Wave 1 ledger, by running
the old command (`./node_modules/.bin/vite`, v8.1.3 — present only because vitest
ships it) against the same clone:

| Request | Before (`vite`) | After (`node scripts/serve.mjs`) |
|---|---|---|
| `GET /` | **404** | 404 (there is no root page; `dev` prints the URL that exists) |
| `GET /demo/graph-rail/index.html` | 200 | 200 |
| `GET /vendor/nodegraph-live/NodeGraph.js` | **500** — "Failed to resolve import … Are they installed?" | **200** |
| `GET /../../../etc/passwd` | — | 404 |

The page therefore *loaded* under vite and rendered nothing, because the renderer
it imports never arrived. "Before: 404/500, after: 200" would have been the
convenient summary; it is not what the three requests actually return.

Split by area, because a single diffstat hides which way the code went:

| Area | Files | + | − |
|---|---:|---:|---:|
| `src/` | 9 | 243 | 359 |
| `src/`, `demo/`, `scripts/` (all non-test code) | 18 | 370 | 677 |
| `tests/` | 7 | 292 | 127 |
| documentation and tours | 16 | 1095 | 105 |

**Code shrank by 307 lines; tests grew by 165; documentation grew by 990.**

## What was deleted

| Deleted | Why it was safe |
|---|---|
| `src/core/dedup.ts`, `src/core/dismissalLearner.ts` | Their port interfaces moved to the new `src/core/ports.ts`; their one real function (`findExistingNoteworthyForEntity`) moved next to its only caller |
| `signalFingerprintHash` + the dead block in `scanActivity` that called it | The orchestrator computed a hash, wrote a three-line comment about it being an optional extension, and threw the value away. `NODE-LOOPS.md` already documented it as a no-op |
| Convex tables `suggestionFeedback`, `roomSuggestionDigests` (≈40 lines) | Nothing in the repository ever wrote them; their only producer was the deleted hash |
| `isEntityDismissed`, `roomNoteworthyQuotaExceeded`, `isEntityDismissedSync` | Three exported wrappers around one store call each. Now one line at the single call site |
| `asEntityType` in `classifier.ts` | Declared, never called. No tool reported it — a non-exported unused function is invisible to knip |
| `scripts/nodemem-smoke.ts` | It ran `runDemo()` and wrote a receipt; `demo/runNodeMemDemo.ts` now does both when given `--json-out` |
| `scripts/capture-storyboard.mjs`, `docs/FEATURE_PROOF_STORYBOARD.md`, `clip:capture` | 51 lines that hashed a GIF and grep'd a markdown file for five phrases. Its own receipt named the retirement condition — "a future standalone showcase should replace this" — and `npm run capture` plus `scripts/record-graph-rail.mjs` are that showcase |
| `"bin": { "nodemem": "./bin/nodemem.mjs" }` | The file does not exist (defect D4). Deleting the claim beats writing a CLI nobody asked for |
| `"build": "tsc --noEmit"` | Byte-identical to `typecheck` and produces no artifact. A command named "build" that builds nothing is a trap |
| `"prepush"` | `check` called `prepush`, which called four other scripts. One name now, doing the same work |

## Custom code replaced by something that already existed

| Custom thing | Replaced by | Effect |
|---|---|---|
| `scripts/nodemem-in-memory-smoke.ts` (94 lines) and `scripts/nodemem-convex-smoke.ts` (59 lines) — hand-rolled runners with their own pass/fail counters, `--json-out` receipt writers and `process.exit` | Vitest, already installed | 153 lines → 62 lines of tests, in the place a stranger looks for assertions. Every assertion was carried over |
| Two copies of a 31-line static file server, one in each capture script | One `scripts/serve.mjs`, imported by both | Also gave `npm run dev` a server that works, deleting the phantom dependency on `vite` |
| `vite` as the `dev` command (undeclared, resolved only transitively through vitest) | 20 lines of `node:http` that the repo already contained twice | `GET /vendor/nodegraph-live/NodeGraph.js` 500 → 200, so the page renders instead of loading empty |
| Four unused methods on the demo's `InMemoryStore` (`listNoteworthy`, `countNoteworthyLastHour`, `getRoomPolicy`, `setRoomPolicy`) | Nothing — the demos never called them; `src/adapters/inMemoryAdapter.ts` is the real reference | The demo copy is now visibly "just enough for the demo" |

## Defects found while measuring, and fixed

Each was proven by a test that failed on the tree *before* the fix.

1. **The demo's classifier had drifted from the library's.** On "The Next Series
   will be announced" the library returned no entity (its stop-name filter checks
   the candidate's first word); the demo copy invented a company called "The Next
   Series" and scored 0.54 against the library's 0.36 — while the page it renders
   claims "same classifier … imported, not re-implemented".
   Fixed in `demo/nodeMemDemoCore.mjs`; `tests/demoMirror.test.ts` now compares
   whole findings across ten texts.
2. **`npm run dev` could not serve the app** (ledger D3). Fixed with
   `scripts/serve.mjs`; `tests/packageContract.test.ts` fails if any script
   invokes a binary no declared dependency provides — restore `"dev": "vite"` and
   it reports `` `vite` is in a script but no declared dependency provides it ``.
3. **`package.json` declared a `bin` that does not exist** (ledger D4). Deleted;
   the same test now fails on any `bin` target that is missing.
4. **The README's `import { computeDebounce } from "nodemem"` did not resolve** —
   the symbol was never in the barrel. Exported; the same test checks every
   symbol the README tells a reader to import.

## Tests changed, and why

Two assertions were removed, both because the code under them was deleted:
`signalFingerprintHash is deterministic` and `isEntityDismissedSync checks set
membership`. No expected value anywhere was edited to match new behaviour, and no
test was skipped. The remaining edits to `tests/scanOrchestrator.test.ts` replace
repeated setup with `scanMessage` from `tests/room.ts`; the assertions are
unchanged.

## Left unresolved, with the reason

| Finding | Why it stays |
|---|---|
| Two copies of the classifier (`src/core/classifier.ts`, `demo/nodeMemDemoCore.mjs`) | Deleting the copy costs a real product promise: a demo that runs with no install and no build, which is also the fallback offered when the page's CDN is blocked. A browser cannot load TypeScript without a build step. Bound by `tests/demoMirror.test.ts`; retirement condition in `docs/codebase/CONCERNS.md` §1 |
| knip: 12 unused files | 11 are `vendor/nodegraph-live/*` and the 12th is `demo/graph-rail/main.js`; both are reached through an HTML `<script>` tag and an importmap, which knip does not parse. `npm run capture` fails if the renderer does not load. No knip config was added — silencing a tool is not the same as the finding being false |
| knip: 7 unused exported types | They name parameters and return values of exported functions. Nothing inside the repo imports them by name; a consumer might |
| jscpd: 1 clone (9 lines) | The shared import header of the two capture scripts, after both were moved onto the same server module |
| `roomActivityOutbox` carries fields NodeMem never writes, and 9 indexes for 2 reads | The row belongs to the host application (NodeRoom). Trimming a schema template on this repository's evidence alone would break a consumer this repository cannot see |
| No run-time input validation in `src/` | Adding a validation layer is feature work, and Wave 3 does not mix feature work with structural change. Recorded in `docs/codebase/CONCERNS.md` §2 |
| `scanActivity` has no try/catch, and no store method is transactional | Same reason. Both are described with their failure mode in `CONCERNS.md` §3 and §4 |
| `package.json` name `nodemem` is taken on npm by an unrelated 2015 package | Renaming a package is a product decision |
| Ledger defects D1 (mobile overflow), D5 (`countNoteworthyForEntity`), D6 (canvas accessibility) | Product defects, not structure. They stay open in `promotion/PROMOTION_LOG.md` |

## Reproducing this report

```bash
npm install
npm run check                  # secret-scan, typecheck, 8 test files, 13-check proof
npx playwright install chromium
npm run capture                # 12 assertions in a real browser
npx knip@5 --no-config-hints
npx jscpd@4 src demo scripts tests --min-lines 5 --min-tokens 50
git diff --shortstat 06ef268
```

For the circular-dependency row, dependency-cruiser needs a rule file; the one
used here contained a single `no-circular` forbidden rule with
`exclude: "(node_modules|vendor)"`. It reported `no dependency violations found`
both before (17 modules) and after (16 modules).
