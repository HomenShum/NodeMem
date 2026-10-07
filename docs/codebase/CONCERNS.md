# Concerns

Everything known to be wrong or unproven, with how to reproduce it. Nothing here
is speculative; a hunch is not a defect.

Product-level defects have their own ledger with reproductions in
[`promotion/PROMOTION_LOG.md`](../../promotion/PROMOTION_LOG.md) — D1 (mobile
overflow), D5 (`countNoteworthyForEntity` never implemented), D6 (canvas
accessibility) are still open there. This file covers the codebase.

## 1. Two copies of the classifier exist

`src/core/classifier.ts` is the original; `demo/nodeMemDemoCore.mjs` is a
plain-JavaScript copy. Both are needed today: a browser cannot load TypeScript
without a build step, and the README's promise of a demo that runs with no
install and no build is a real product commitment (it is also the fallback the
graph rail offers when its CDN is blocked).

They had already drifted. `tests/demoMirror.test.ts` now compares the whole
finding across ten texts, so drift fails the suite instead of a screenshot.

**Retirement condition:** the day a build step or Node's type stripping is
acceptable for the demo surfaces, delete `demo/nodeMemDemoCore.mjs` and the
mirror test with it.

## 2. No run-time input validation anywhere in `src/`

`ScanInput` is a compile-time interface. Nothing checks that `text` is a string,
that `roomId` is non-empty, or that the row id exists. A host passing raw user
input passes it straight into the regexes. No defect has been observed from this
— the regexes are linear and bounded — but a very long string is scanned in full,
seven times.

The only run-time guard in the repository is the path check in
`scripts/serve.mjs`, which rejects anything resolving outside the repo root
(verified: `GET /../../../etc/passwd` → 404).

## 3. Store failures are not handled

`scanActivity` has no try/catch. A rejected store call propagates to the caller
and the row keeps its previous status, which is the honest outcome — a
half-written verdict would be worse — but nothing retries, logs, or marks the row
`failed`, even though `failed` is a valid `ActivityStatus`.

## 4. The scan is not concurrency-safe

Two scans in the same room can both read `countNoteworthyLastHour` before either
writes, and both pass the quota gate. The same race exists for entity dedup. No
store method is transactional and the port does not offer one. Single-writer
hosts are unaffected; a fan-out host would exceed its own quota.

## 5. `roomActivityOutbox` carries fields this library never writes

`src/adapters/convexSchema.ts` declares `decision`, `latestJobId`, `attempts`,
`error`, `lastScannedAt`, `dismissedBy` and an `actor` object, plus nine indexes.
The scan writes four fields and exercises two indexes. The rest belong to the
host application that owns the row (NodeRoom). Left alone deliberately: trimming
a schema template on this repository's evidence alone would break a consumer this
repository cannot see.

## 6. `npm i nodemem` installs somebody else's package

`package.json` says `"name": "nodemem"`. That name on npm belongs to an unrelated
package published in 2015 (`npm view nodemem maintainers` → `orilla`). This
package therefore cannot publish under that name, and every README snippet that
says `from "nodemem"` is aspirational. Renaming is a product decision, not a
refactor, so Wave 3 left it and recorded it here.

## 7. Static analysis reports things that are not true, and why

- **knip: 12 unused files.** Eleven are `vendor/nodegraph-live/*`; the twelfth is
  `demo/graph-rail/main.js`. Both are reached only through an HTML `<script>` tag
  and an importmap, which knip does not parse. Proof they are live:
  `grep -n "vendor/nodegraph-live" demo/graph-rail/main.js`, and `npm run capture`
  fails if the renderer does not load.
- **knip: `scripts/record-graph-rail.mjs` unused.** It is a manual, once-a-release
  command documented in the README; it has no npm script because it needs `ffmpeg`
  on `PATH`.
- **knip: 7 unused exported types.** These are the library's type vocabulary
  (`ScanConfig`, `DebounceState`, `EntityType`, `SourceKind`, `EventKind`, and the
  demo runner's two result types). They name parameters and return values of
  exported functions; nothing inside the repository imports them by name, and a
  consumer might.
- **jscpd: 1 remaining clone.** Nine lines of import header shared by
  `scripts/capture-graph-rail.mjs` and `scripts/record-graph-rail.mjs`. Both now
  import the same server from `scripts/serve.mjs`; what is left is the import list.

No knip/jscpd/dependency-cruiser configuration file was added. Silencing a tool
with config is not the same as the finding being false.

## 8. What was measured and what was only reasoned about

Measured this wave, on this tree: the tool counts in
`docs/SIMPLIFICATION_REPORT.md`, `npm test`, `npm run typecheck`, `npm run proof`,
`npm run capture`, and `npm run dev` serving `200` for the page, its module and
the vendored renderer.

Not measured: performance of any kind, behavior under concurrency, behavior on a
real Convex deployment, and any viewport other than 1400×860.
