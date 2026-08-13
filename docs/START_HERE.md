# START HERE — one message, followed all the way through

Read this in the order it runs, not in the order the folders are named.

**What this software is for.** Imagine an analyst in a shared workspace typing
"Met with CardioNova last week — they just raised a Series A." A useful system
notices that a company came up and offers to look it up. A harmful system starts
looking it up on its own, twenty times an hour, on every name it half-recognises.
NodeMem is the first kind. It reads activity, decides what is worth a person's
attention, and stops. Turning a suggestion into an action is always a human's
click. The repo states it as **notice passively, act explicitly.**

**Run it first, then read.**

```bash
npm install
npm run demo        # the whole pipeline in the terminal, 13 checks
npm run dev         # http://127.0.0.1:5173/demo/graph-rail/index.html
npm run capture     # the browser gate: 12 checks, exits nonzero if the page lies
npm test            # the unit suite: 8 test files
```

Nine steps follow. Steps 5 and part of 3 say "this does not exist here" — that
is deliberate; a stage nobody built is more useful named than invented.

---

## Step 1 — The entry point is a static file server, not a web framework

**File:** `scripts/serve.mjs`
**Symbol:** `serveRepo` (`scripts/serve.mjs:45`)
**Called by:** `npm run dev`, `scripts/capture-graph-rail.mjs`, `scripts/record-graph-rail.mjs`
**Calls next:** nothing — it hands files to the browser, which then loads `demo/graph-rail/index.html`

**Why this exists**
NodeMem is a library, not a web application: there is no router, no server-side
rendering, no API. The one page a human can open is hand-written HTML and ES
modules that resolve through an importmap, so the only thing it needs from a
server is correct MIME types. Anything more would be a framework nobody uses.

**Core code**
```js
export async function serveRepo(port = 0) {
  const server = http.createServer(async (req, res) => { /* … read file, guard the path … */ });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}
```

**Input** — an optional port; `0` means "any free port", which is what the
capture scripts use so two runs never collide.
**Output** — a listening server and its origin.
**Failure behavior** — any path that resolves outside the repository, or any
missing file, returns `404`. There is no directory listing.
**Next** — the browser loads the page in Step 2.

---

## Step 2 — The primary user action: activity arrives, and a person later says yes or no

**File:** `demo/graph-rail/main.js`
**Symbol:** `runPipeline` (`demo/graph-rail/main.js:81`), then `renderSuggestion` (`demo/graph-rail/main.js:38`)
**Called by:** the page itself, on load — `runPipeline();` (`demo/graph-rail/main.js:126`)
**Calls next:** `classifyNoteworthy`, then `session.observe` for anything noticed

**Why this exists**
This is the honest miniature of the whole product. Four fixture messages arrive
the way a real activity stream would. Each is classified; entities that survive
are drawn as dim, uncounted nodes; each becomes a *suggestion card with two
buttons*. Nothing is connected in the graph until a human presses Confirm.

**Core code**
```js
for (const text of DEMO_EVENTS) {
  const finding = classifyNoteworthy(text);
  if (finding.action === "ignore" || finding.entities.length === 0) continue;
  for (const e of finding.entities) session.observe([entityRef(e)], undefined, { … });
  // a suggestion is rendered; NO edge is drawn here
}
```

**Input** — plain strings from `demo/nodeMemDemoCore.mjs` (`DEMO_EVENTS`).
**Output** — log lines, nodes with `count === undefined`, and suggestion cards
carrying `data-testid="suggestion"`.
**Failure behavior** — if the page's modules cannot load at all, nothing in this
file ever runs; Step 8 is the guard that covers exactly that.
**Next** — the same classifier, in TypeScript, is Step 3.

---

## Step 3 — What "trusted input" means here: a score, not a validator

**File:** `src/core/classifier.ts`
**Symbol:** `classifyNoteworthy` (`src/core/classifier.ts:108`)
**Called by:** `scanActivity`, the demos, the graph rail
**Calls next:** nothing — it is a pure function with no I/O and no model call

**Why this exists**
Something has to decide that "Met with CardioNova, they raised a Series A" is
worth attention and "lunch tomorrow" is not, deterministically and offline. Six
regular expressions look for six kinds of signal; each one found adds 0.18 to a
score; the score picks an action. Same text in, same finding out, forever — which
is why a screenshot of it can be a test.

**There is no schema validation layer in this repository.** `ScanInput` is a
TypeScript interface, enforced at compile time and trusted at run time. A host
passing unvalidated user text is passing it straight in. The only run-time input
guard in the repo is the path check in Step 1. That is a real gap, recorded in
[`codebase/CONCERNS.md`](codebase/CONCERNS.md).

**Core code**
```ts
const score = Math.min(1, 0.18 + sortedSignals.length * 0.18);
action: score >= 0.70 ? "start_research_job"
      : score >= 0.50 ? "create_coach_cue"
      : score >= 0.35 ? "index_only" : "ignore",
```

**Input** — one string of any length.
**Output** — a `NoteworthyFinding`: score, action, signals, evidence spans,
facets, and at most one entity.
**Failure behavior** — cannot throw on ordinary input; empty text scores 0.18 and
returns `ignore` with no entities.
**Next** — the finding enters the pipeline in Step 4.

---

## Step 4 — The pipeline: seven gates, and the first one that trips wins

**File:** `src/core/scanOrchestrator.ts`
**Symbol:** `scanActivity` (`src/core/scanOrchestrator.ts:101`)
**Called by:** a host application; here, `demo/demo-runner.ts` and the tests
**Calls next:** `classifyNoteworthy`, `resolveAssistivePolicy`, then the store

**Why this exists**
This is the whole product in one function. Everything a room can do to say "not
that, not now, not so often" is one early return, and each return writes the
reason onto the row — so when a user asks "why did nothing appear?", support can
answer from data instead of guessing.

**There is no agent and no model here.** Nothing in `src/` calls an LLM
(`grep -rn "openai\|anthropic\|fetch(" src/` returns nothing). "Orchestration" in
this repo means this deterministic sequence.

**Core code**
```ts
if (finding.action === "ignore") return settle("not_noteworthy");
if (policy.mode === "off") return settle("not_noteworthy", "policy_off");
if (isSignalDisabled(…)) return settle("not_noteworthy", "signal_disabled_by_policy");
if (policy.mode === "approved_watchlist_only" && !isEntityWatchlisted(…)) return settle("not_noteworthy", "not_on_watchlist");
if (await store.countNoteworthyLastHour(roomId) >= maxPerRoomPerHour) return settle("not_noteworthy", "room_quota_exceeded");
if (await findExistingNoteworthyForEntity(…)) return settle("not_noteworthy", "duplicate_entity");
if (entityNames.length && await store.isEntityDismissed(…)) return settle("not_noteworthy", "previously_dismissed");
return settle("noteworthy");
```

**Input** — a `MemoryStore`, one `ScanInput` row, an optional `ScanConfig`.
**Output** — a `ScanResult` whose `status` is `noteworthy` or `not_noteworthy`,
plus the `reason` when something withheld it.
**Failure behavior** — no try/catch. If the store rejects, the rejection
propagates to the caller and the row keeps its previous status. That is
deliberate (a half-written verdict would be worse) and is listed in
[`codebase/CONCERNS.md`](codebase/CONCERNS.md).
**Next** — the store contract itself, Step 6.

---

## Step 5 — Tool registration and invocation: does not exist in this repository

NodeMem registers no tools, exposes no MCP server, and invokes nothing external.
The nearest thing to a registry is the storage seam in Step 6: a host supplies
one object, and NodeMem calls exactly seven methods on it.

The signal-scoped dismissal hook that a tool layer would have used was dead code
computing a hash nobody read; Wave 3 deleted it rather than leave a stub that
looks like a feature. See `docs/SIMPLIFICATION_REPORT.md`.

---

## Step 6 — Persistence: seven methods, and the verdict written back

**File:** `src/core/ports.ts` (contract) and `src/adapters/inMemoryAdapter.ts` (reference)
**Symbol:** `MemoryStore` (`src/core/ports.ts:76`) / `patchRow` (`src/adapters/inMemoryAdapter.ts:66`)
**Called by:** `scanActivity` via the local `settle` helper
**Calls next:** your database; in the demo, a `Map`

**Why this exists**
NodeMem must not care whether you run Convex, Postgres or nothing at all. One
interface is the entire dependency on storage, and reading it is how a new
engineer learns what NodeMem remembers: activity rows, dismissals, room policy.

**Core code**
```ts
export interface MemoryStore extends DismissalStore, DedupStore, PolicyStore {
  patchRow(id: string, patch: { status: ActivityStatus; finding?: NoteworthyFinding; reason?: string; updatedAt: number }): Promise<void>;
}
```

**Input** — the row id and the verdict.
**Output** — nothing; the row now carries its status, finding and reason.
**Failure behavior** — `InMemoryAdapter.patchRow` silently ignores an unknown id.
A real adapter should not; the contract does not currently say so.
**Next** — how any of this reaches a human, Step 7.

---

## Step 7 — Rendering: a suggestion draws nothing until a person clicks

**File:** `demo/graph-rail/main.js`
**Symbol:** `App` (`demo/graph-rail/main.js:113`) with `useSyncExternalStore`; the Confirm handler `confirm.addEventListener` (`demo/graph-rail/main.js:63`)
**Called by:** React, on every graph mutation
**Calls next:** `NodeGraph` from `vendor/nodegraph-live/react.js`

**Why this exists**
The rail is where the doctrine becomes visible. A noticed entity appears dim and
explicitly uncounted ("unknown — not measured"). A suggestion appears as a card
and changes the graph not at all. Only the Confirm click calls `session.observe`
with two endpoints, drawing one faint traversal edge — a recorded hop, still not
evidence. `assertEdge` is never called anywhere, because NodeMem has no curated
source that would justify an assertion.

**Core code**
```js
confirm.addEventListener("click", () => {
  session.observe([s.a, s.b], undefined, { eventId: `confirmed:${s.id}` });
});
```

**Input** — a suggestion `{ a, b, score, action }`.
**Output** — one traversal edge, and a resolved card.
**Failure behavior** — Dismiss records a dismissal and changes the graph not at
all, on purpose.
**Next** — what a human sees when the page cannot start, Step 8.

---

## Step 8 — Failure and recovery: the reporter cannot live inside the thing that failed

**File:** `demo/graph-rail/index.html`
**Symbol:** the classic `<script>` (`demo/graph-rail/index.html:95`) and the alert panel `data-testid="boot-error"` (`demo/graph-rail/index.html:52`)
**Called by:** the browser, always — it is not a module
**Calls next:** nothing; it hides the graph and shows a named cause

**Why this exists**
Every pixel of that page is produced by one ES module whose imports resolve to
`esm.sh`. If any of those fetches fails, the module body never executes, so the
page's own logging function never exists. Before this guard, a blocked CDN
produced headings, confident prose, and three empty boxes — no error text at all.
The guard therefore lives in a classic script that always runs, with an 8-second
watchdog for the silent variants (a hang, an importmap miss, a throw during
evaluation) — all of which leave `window.__graphRail` unset.

**Core code**
```js
document.getElementById("rail-module").addEventListener("error", function () {
  fail("A module it needs could not be downloaded.");
});
setTimeout(function () { fail("It did not finish loading within 8 seconds."); }, 8000);
```

**Input** — the module element's `error` event, or eight seconds of silence.
**Output** — a `role="alert"` panel naming `esm.sh`, a working Retry, a
no-network terminal fallback, and the caption hidden so it cannot describe a
graph that is not there.
**Failure behavior** — this *is* the failure behavior. Phase 2 of
`scripts/capture-graph-rail.mjs` blocks the CDN and fails the build if any of
those six properties is missing.
**Next** — what proves all of the above, Step 9.

---

## Step 9 — The tests that prove this flow

| What it proves | File | Command |
|---|---|---|
| The seven gates, one test per reason — and a check that a new gate cannot arrive without one | `tests/scanOrchestrator.test.ts` | `npm test` |
| The classifier's thresholds and stop-name filtering | `tests/classifier.test.ts` | `npm test` |
| The reference store satisfies the port | `tests/inMemoryAdapter.test.ts` | `npm test` |
| The demo's JavaScript copy of the classifier has not drifted from the TypeScript original | `tests/demoMirror.test.ts` | `npm test` |
| The README's import lines resolve, no script invokes an undeclared binary, no `bin` points at a missing file | `tests/packageContract.test.ts` | `npm test` |
| The Convex schema still loads at run time | `tests/convexSchema.test.ts` | `npm test` |
| Every `symbol` (`path:line`) citation in this document still lands on that symbol, and the counts above are the tree's | `tests/docs.test.ts` | `npm test` |
| Every guided tour step still lands on the symbol it names | `tests/tours.test.ts` | `npm test` |
| The whole pipeline end to end, with a receipt | `demo/demo-runner.ts` | `npm run proof` |
| The rendered page: zero edges before a human confirms, exactly one after, and a legible failure when the CDN is blocked | `scripts/capture-graph-rail.mjs` | `npm run capture` |

**Where to add one adjacent capability.** A new suppression rule is one early
return in `scanActivity` plus one test in `tests/scanOrchestrator.test.ts`. A new
signal is one regex in `classifyNoteworthy`, the same regex mirrored into
`demo/nodeMemDemoCore.mjs` (`tests/demoMirror.test.ts` fails until you do), and
one row in the README's signal table. A new backend is one class implementing
`MemoryStore`, with `InMemoryAdapter` as the worked example.
