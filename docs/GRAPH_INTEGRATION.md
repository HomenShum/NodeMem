# Graph integration: what NodeMem's events are entitled to draw

NodeMem is a passive noticer: it scans activity text, extracts entities, and
surfaces suggestions that a human must act on. NodeGraph Live (vendored under
`vendor/nodegraph-live/`) is a renderer with an epistemic type system: its
three edge types — `evidence`, `traversal`, `assertion`
(`vendor/nodegraph-live/graph-model.d.ts`, `EDGE_TYPES`) — encode *how a
relationship is known*, not how it looks. This document maps every event in
NodeMem's pipeline to the trust class it is actually entitled to, quotes what
the current wiring deliberately refuses to draw, and names the exact type and
field changes that would unlock the next class honestly.

The live wiring under audit is `demo/graph-rail/main.js`, which imports the
pipeline verbatim from `demo/nodeMemDemoCore.mjs` (itself extracted, code
unchanged, from the CLI demo — the classifier and store mirror
`src/core/classifier.ts` and `src/adapters/inMemoryAdapter.ts`). The claims
below are executable: `scripts/capture-graph-rail.mjs` exits nonzero if any of
them stops being true.

## The trust-class grammar being written into

From `vendor/nodegraph-live/graph-model.d.ts`:

- **`evidence`** — "a MEASURED relationship. The weight came from an external
  system of record (an API count, a database aggregate)". Evidence edges own
  the width channel.
- **`traversal`** — "interaction history... telemetry about us, not evidence
  about the world". Constant width, lighter ink.
- **`assertion`** — "a curated claim carrying a complete source receipt"
  (`AssertionReceipt`: `source`, `release`, `subjectId`, `objectId`, `url`).
  Curated is not measured: constant width, release rendered as a badge.

The entry points (`vendor/nodegraph-live/session.d.ts`):

- `GraphSession.observe(entities, measuredCount?, options?)` — "Exactly two
  participants plus a measured conjunction produce evidence. Three or more
  participants, or a pair with no measurement, produce only traversal
  telemetry."
- `GraphSession.assertEdge(a, b, receipt, options?)` — "A curated assertion is
  accepted only with the complete replay receipt."
- `EntityRef.count?: number` — "A measured magnitude for this entity alone.
  Absent means unknown." Same for `GraphNode.count`: "Never summed or
  estimated here. Absent means unknown. A measured zero is the number 0."

## (a) NodeMem's event taxonomy, mapped to trust classes

Every pipeline event, what it extracts, whether anything is *measured* at that
moment, and what the graph is therefore entitled to show:

| Pipeline event | Where it happens | Entities extracted | Is anything MEASURED? | Trust class earned | Why |
|---|---|---|---|---|---|
| Activity item scanned | `classifyNoteworthy(text)` in `demo/nodeMemDemoCore.mjs` (source: `src/core/classifier.ts`); orchestrated by `src/core/scanOrchestrator.ts` | `EntityDetection[]` — `{type, displayName, entityKey, confidence}` plus `facets`, `evidenceSpans`, `score` | No. `score` and `confidence` are heuristic regex outputs of `noteworthy-v1`, not counts from any system of record | None by itself — a scan that clears the noteworthy bar leads to *noticing*; one below it (`action: "ignore"`) draws nothing | A classifier score is the pipeline's opinion of its own regexes. Nothing external was consulted, so nothing is entitled to ink |
| Entity noticed | `session.observe([entityRef(e)], undefined, {eventId: "notice:..."})` in `demo/graph-rail/main.js` | One `EntityRef` (`{kind, label}` — no `count`) | No. The second argument is literally `undefined`; `EntityDetection` has no count field to pass | **Node only, unmeasured** — dim, edge-less. A single participant can never form an edge of any type | Noticing is an unmeasured observation. `EntityRef.count` absent means unknown, and the renderer says so on screen: "unknown — not measured" |
| Suggestion surfaced | `renderSuggestion(...)` in `demo/graph-rail/main.js`; the pair is entity ↔ facet from `NoteworthyFinding` | None into the graph — the suggestion is a DOM card, not a graph mutation | No. The suggestion carries the same heuristic `score` | **Nothing.** Zero graph calls | A suggestion is a question addressed to a human. Drawing it would render the classifier's guess as if it were a relationship in the world |
| Suggestion confirmed | Confirm button handler: `session.observe([s.a, s.b], undefined, {eventId: "confirmed:..."})` | Two `EntityRef`s (entity + facet), still no count | No. A human click is consent, not a measurement — `measuredCount` stays `undefined` | **`traversal`** — exactly one faint, constant-width edge per confirm | Per `session.d.ts`, a pair with no measurement produces "only traversal telemetry". The click records that a human walked this pair together — a confirmed hop, telemetry about us, not evidence about the world |
| Suggestion dismissed | Dismiss button handler: `store.recordDismissal(ROOM, [label], "human")` (`InMemoryStore` in `demo/nodeMemDemoCore.mjs`; contract: `DismissalStore` in `src/core/ports.ts`) | None into the graph | No — but a count *starts accumulating*: `DismissalEntry.dismissCount` increments in `src/adapters/inMemoryAdapter.ts` | **Nothing.** The graph does not change | Dismissal is negative feedback to the *suggestion pipeline* (future suggestions for that entity are suppressed via `isEntityDismissed`). It says nothing about relationships in the world, so it earns no ink |
| Dedup hit | `activityDedupeKey` (`src/core/dedupeKey.ts`) coalesces rapid activity; `isDuplicateSuggestion` / quota via `DedupStore.countNoteworthyLastHour` (`src/core/ports.ts`) | None — the point is that a repeat extracts *nothing new* | The store counts rows (`countNoteworthyLastHour` is a real count), but of NodeMem's own activity, not of the world | **Nothing** — and crucially, no strengthening of existing nodes or edges | Replaying the same event must not make a relationship look stronger — the same rule `GraphSession` enforces internally with its `seen` receipts. A dedup hit is the system recognizing its own echo |

The bar the wiring clears: nothing in this table is entitled to an `evidence`
edge (no measured conjunction exists anywhere in the pipeline) or an
`assertion` edge (no curated source with a versioned release exists), and the
wiring draws neither.

## (b) What today's wiring feeds — and what it deliberately refuses

What it feeds:

- Every noticed entity → `observe([entity], undefined)` → an unmeasured, dim
  node (`demo/graph-rail/main.js`, `runPipeline`).
- Every human Confirm → `observe([a, b], undefined)` → exactly one traversal
  edge (Confirm handler, same file).
- Nothing else touches the `GraphSession`.

The refusals are stated in the integration commit itself (6a7c10a, "Live graph
rail: passive noticing rendered honestly by NodeGraph Live"), quoted verbatim:

> The contract is the demo: a noticed entity lands with no count
> ("unknown -- not measured", dim), a suggestion draws nothing, and only
> a human clicking Confirm draws an edge -- faint traversal history, a
> confirmed hop, still not a measurement. assertEdge is never called;
> NodeMem has no versioned curated source. Dismissal feeds
> recordDismissal and changes nothing in the graph.

Each refusal, unpacked:

1. **Confirm → traversal, not evidence.** The tempting bug is to treat a human
   click as a measurement and pass a weight. The click proves a human looked;
   it does not produce a number from a system of record, so the wiring passes
   `measuredCount: undefined` and the session demotes the pair to traversal.
2. **`assertEdge` is never called.** `assertEdge` requires a complete
   `AssertionReceipt` — `source`, `release`, `subjectId`, `objectId`, `url`
   (`graph-model.d.ts`). NodeMem has no curated source, no versioned release,
   and no stable per-entity source identifiers, so it cannot fill the receipt
   without inventing fields. It therefore does not call the method at all.
3. **No versioned curated source.** `classifierVersion: "noteworthy-v1"`
   (`src/core/classifier.ts`) versions the *heuristic*, not a curated
   knowledge release. A classifier version is which regexes ran, not which
   reviewed dataset a claim came from.
4. **Dismissal changes nothing in the graph.** It routes to
   `recordDismissal` and dismissal learning only.

`scripts/capture-graph-rail.mjs` is these refusals as an executable gate: it
fails the build if any edge exists before a confirmation, then confirms one
suggestion and requires exactly one edge whose type includes `traversal`.

## (c) Named API gaps: the exact change that unlocks the next trust class

### Gap 1 — entity occurrence counts exist in the store but are not plumbed (unlocks measured *node* counts)

NodeMem's stores already count things about their own corpus:

- `DedupStore.countNoteworthyLastHour(roomId)` (`src/core/ports.ts`) — a real
  count of noteworthy rows.
- `NoteworthyRow.entityNames` (`src/core/ports.ts`) — every noteworthy row
  names its entities, so "how many activity rows mention CardioNova" is one
  filter away in any adapter (`src/adapters/inMemoryAdapter.ts` holds the rows;
  `src/adapters/convexSchema.ts` indexes `roomActivityOutbox` the same way).
- `DismissalEntry.dismissCount` (`src/core/ports.ts`) — already
  incremented per repeat dismissal in `src/adapters/inMemoryAdapter.ts`.

None of this reaches the graph, because no type carries it there. The change:

- Add `countNoteworthyForEntity(roomId, entityKey): Promise<number>` to
  `DedupStore` (or `MemoryStore` in `src/core/scanOrchestrator.ts`), and let
  the rail pass it through: `observe([{kind, label, count}], undefined)`.
  `EntityRef.count` (`session.d.ts`) is already waiting for exactly this.

Honesty caveat, so this is not oversold: that count measures *NodeMem's own
activity stream* (a database aggregate over rows NodeMem wrote), not the world.
It is a legitimate measured magnitude for the node under the renderer's
definition, and it must be labeled as what it counts — mentions in this room's
activity — nothing more.

### Gap 2 — no measured conjunction for any pair (blocks `evidence` edges)

`observe(a, b, measuredCount)` produces evidence only when `measuredCount` is a
real number from a system of record. Nothing in NodeMem measures a *pair*:
`classifyNoteworthy` emits at most one entity per event
(`entities: candidates.length` (`demo/nodeMemDemoCore.mjs:91`) builds an
array of at most one element), and facets are string tags, not measured
quantities. The change:

- A co-occurrence count in the store: `countRowsMentioningBoth(roomId, keyA,
  keyB): Promise<number>` over `NoteworthyRow.entityNames` — which first
  requires the classifier to emit *multiple* entities per event
  (`NoteworthyFinding.entities` is already an array; the extraction in
  `src/core/classifier.ts` just stops at `candidates[0]`).
- Then, on Confirm, the rail could probe that count and call
  `session.observe([a, b], count)` — human consent to draw, store measurement
  for the weight. Same caveat as Gap 1: it measures NodeMem's corpus.
- An external variant — the entity paired with a count probed from a real
  registry (the pattern TrialScope uses against ClinicalTrials.gov
  `totalCount`s) — would be evidence about the world, but that is a new
  upstream integration, not a field change.

### Gap 3 — no versioned curated source (blocks `assertion` edges)

`assertEdge` demands an `AssertionReceipt` with a `release` ("Versioned release
containing the assertion"), stable `subjectId`/`objectId`, and a replayable
`url`. NodeMem's nearest types cannot fill any of it:

- `EntityDetection` (`src/core/classifier.ts`) has `entityKey` — a normalized
  string from `normalizeEntityKey`, not a stable identifier in any external
  system.
- `NoteworthyFinding.classifierVersion` versions the heuristic, not a curated
  dataset release.
- `EvidenceSpan.text` is a 200-char slice of the user's own activity text —
  quotable, but not a curating system of record.

The change, if NodeMem ever wants assertion edges: a curated watchlist or
entity registry with an explicit release field — e.g. a
`CuratedEntityLink {source: string; release: string; subjectId: string;
objectId: string; url: string}` maintained by a human (a reviewed
room watchlist would qualify; `AssistivePolicy.watchlist` in
`src/core/policyResolver.ts` is a plain `string[]` today — unversioned,
unreviewed, no per-entry identity or URL, so it does not). Until an entry can
cite its release and be re-opened at a URL, NodeMem is not entitled to the
badge, and the honest move is the current one: never call `assertEdge`.

## (d) The next honest upgrade

The next honest upgrade is Gap 1: plumb the mention counts the store already
tracks into `EntityRef.count`, so a noticed node can say "CardioNova — 3
mentions in this room's activity" instead of "unknown — not measured". It adds
one query to the `DedupStore` port and one argument at one call site, upgrades
no edge — confirms stay traversal, `assertEdge` stays uncalled — and it turns
a database aggregate NodeMem already owns into the renderer's measured-node
channel without borrowing anyone else's epistemology. Everything past that
(co-occurrence evidence, curated assertions) requires either a classifier that
extracts entity *pairs* or a versioned curated source that does not exist yet,
and pretending otherwise is exactly the class of overclaim the capture gate
exists to fail.
