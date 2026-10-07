# Structure

Nine files ship. Everything else demonstrates, tests or captures them.

```
src/                          the library — this is what a consumer imports
  index.ts                    the barrel: 28 names, nothing else is public
  core/
    classifier.ts             text -> finding (score, signals, entity). Pure, no I/O
    scanOrchestrator.ts       the pipeline: seven gates, one verdict per row
    policyResolver.ts         how much noticing a room allows; quieter setting wins
    ports.ts                  the entire storage contract, in one file
    dedupeKey.ts              a stable key for "same source, same author"
    debouncer.ts              sliding quiet window, so a burst of typing is one scan
  adapters/
    inMemoryAdapter.ts        the reference MemoryStore, backed by three Maps
    convexSchema.ts           the same store as three Convex tables

demo/
  demo-runner.ts              the 13-check story: classify, scan, dedup, dismiss, policy, quota
  runNodeMemDemo.ts           `npm run demo` and `npm run proof` (adds --json-out)
  runNodeMemDemo.mjs          `npm run demo:node` — no install, no build
  nodeMemDemoCore.mjs         plain-JS copy of the classifier for the two no-build surfaces
  graph-rail/
    index.html                the one page a human can open; importmap + boot guard
    main.js                   the pipeline rendered live; Confirm/Dismiss handlers

scripts/
  serve.mjs                   static server: `npm run dev`, and both capture scripts
  capture-graph-rail.mjs      the browser gate — 12 checks, screenshots, exits nonzero
  record-graph-rail.mjs       records the README clip (needs ffmpeg on PATH)
  secret-scan.mjs             regex sweep for keys and tokens

tests/                        vitest; see TESTING.md
vendor/nodegraph-live/        built copy of the graph renderer, browser-only
promotion/                    the product-loop record: goal, journeys, defect ledger
docs/                         START_HERE, the simplification report, and this folder
assets/, promotion/evidence/  screenshots and clips, each with a producer script
```

## Where to look first

| Question | File |
|---|---|
| What does this thing actually do? | `docs/START_HERE.md` |
| Why was a suggestion withheld? | `src/core/scanOrchestrator.ts` — every `reason` is one line |
| What must my database do? | `src/core/ports.ts` — all of it, nothing elsewhere |
| What counts as noteworthy? | `src/core/classifier.ts`, six regexes |
| What does a user see? | `demo/graph-rail/index.html` + `main.js` |
| What is known to be wrong? | `docs/codebase/CONCERNS.md`, `promotion/PROMOTION_LOG.md` |

## Naming conventions worth knowing

- **room** — one shared workspace. Every policy, quota and dismissal is scoped to
  a room, never global.
- **activity row** — one unit of noticed activity, patched in place; nothing is
  deleted.
- **finding** — the classifier's output for one piece of text.
- **suggestion** — a row whose status reached `noteworthy`. It is an offer, never
  a job.
- **noticing** vs **evidence** — the graph rail draws noticed entities dim and
  uncounted. Only a human confirmation draws an edge, and even that is traversal
  history, not a measurement.
