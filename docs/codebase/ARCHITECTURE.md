# Architecture

## The one rule

A person is typing in a shared workspace. Something in the system notices a
company name and would like to go read about it. **It may offer. It may not go.**

Everything below exists to keep that true under load, over time, and after the
user has already said no once.

```
activity  ─► debounce ─► classify ─► seven gates ─► status written on the row
(a message)  (optional)  (regexes)   (policy, quota,     │
                                      dedup, dismissal)  └─► a human sees a suggestion
                                                              └─► a human clicks ─► the host acts
```

The arrow from "a human clicks" to "the host acts" is outside this repository on
purpose. NodeMem has no code that starts a job.

## Three boundaries, and what each one refuses to know

**1. `classifyNoteworthy` knows nothing about storage, rooms or users.**
`src/core/classifier.ts` is a pure function: string in, finding out. Same input
always gives the same output, which is what makes a fixed corpus a valid test and
why the demo can assert `JSON.stringify(f1) === JSON.stringify(f2)`.

**2. `scanActivity` knows nothing about databases.**
`src/core/scanOrchestrator.ts` talks only to the `MemoryStore` interface. Swap
Convex for Postgres and this file does not change. It is also the only file that
decides *why* something was withheld — the seven `reason` strings exist nowhere
else.

**3. `MemoryStore` knows nothing about the pipeline.**
`src/core/ports.ts` is seven methods. An adapter implements them and is done;
`src/adapters/inMemoryAdapter.ts` is the worked example and the thing the tests
run against.

## The gate order matters

Cheap and local first, expensive and remote last:

1. classify (no I/O)
2. policy mode / disabled signals / watchlist (one read, usually cached by the host)
3. hourly quota (one count)
4. entity dedup (one list read)
5. dismissal (one read)

A room that turned noticing off never issues the dedup query. Reordering these
would be a behavior change, not a refactor.

## Why the browser page is built the way it is

`demo/graph-rail/index.html` is hand-written HTML with an importmap pointing at
`esm.sh`, plus one ES module (`main.js`). There is no bundler, so the page can be
served by any static file server — which is what makes `npm run dev` twenty lines
instead of a framework.

That choice has one sharp edge, and the page is shaped around it: **if any module
in the import graph fails to fetch, the module body never executes.** The page's
own logging function lives in that module, so the code that would report the
failure is the code that failed. The reporter therefore lives in a *classic*
`<script>` that always runs, with an 8-second watchdog for the silent variants.
Phase 2 of `scripts/capture-graph-rail.mjs` blocks `esm.sh` and asserts six
properties of the resulting error state, so the guard cannot rot.

## Honesty rules the rail enforces

These are asserted by `npm run capture`, not just described:

- A noticed entity is drawn dim with `count === undefined` — "unknown, not
  measured". Noticing is not evidence.
- A suggestion mutates the graph **not at all**. Zero edges may exist before a
  human confirms; the capture script exits nonzero if one does.
- A confirmation draws exactly one edge, typed `traversal` — a recorded hop, not
  a measurement.
- `assertEdge` is never called anywhere in the repository, because NodeMem has no
  versioned curated source that would justify an assertion badge.

## Deliberate non-goals

- No agent, no model, no network calls from `src/`.
- No job queue, no scheduler. The debouncer computes *when* a scan should fire and
  hands that number back; the host owns the timer.
- No multi-entity findings. The classifier returns at most one entity per text
  (`entities: candidates.length ? [ … ] : []`), which is why the graph rail pairs
  an entity with a *facet* rather than with another entity.
