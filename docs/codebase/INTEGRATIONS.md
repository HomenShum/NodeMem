# Integrations

Four things outside this repository can affect it. None of them needs an account,
an API key, or a paid plan.

## 1. Convex — one file, schema only

**Where:** `src/adapters/convexSchema.ts`, the only importer of the only runtime
dependency (`convex/server`, `convex/values`).

It declares three tables and their indexes; it contains no queries, no mutations
and no deployment config. Copy it into your Convex project's `convex/` directory
and merge the exports into your `schema.ts`, then implement `MemoryStore` against
`QueryCtx`/`MutationCtx`.

`tests/convexSchema.test.ts` proves the module still loads at run time — a
typecheck would not catch a broken or missing Convex install.

**No deployment is required to run anything in this repository.**

## 2. esm.sh — the browser demo's CDN

**Where:** the importmap in `demo/graph-rail/index.html` (React 19.2, graphology
0.26, forceatlas2 0.10.1, sigma 3.0.3, @sigma/node-border 3.0.0).

These are fetched at page load. Nothing installs them, and they are not in
`package.json` — the page has no bundler. **If that CDN is blocked, the page
cannot render anything**, so the page carries a boot guard and a named error
state; `npm run capture` blocks `esm.sh` deliberately and asserts the failure is
legible. The offline fallback the error panel offers is real:
`node demo/runNodeMemDemo.mjs` runs the same classifier with no network at all.

## 3. NodeGraph Live — vendored, not installed

**Where:** `vendor/nodegraph-live/`, imported by `demo/graph-rail/main.js`.

A built copy of [`@homenshum/nodegraph-live`](https://github.com/HomenShum/NodeGraph).
Its README says the copy retires when the package reaches npm. Until then it is
checked in, and static-analysis tools will keep reporting it as unused because
its only importer is loaded by an HTML `<script>` tag.

The API used is small: `new GraphSession({ maxNodes, maxEdges, maxSeen })`,
`session.observe(refs, count, meta)`, `session.getSnapshot()`,
`session.subscribe`, and the `NodeGraph` React component.

## 4. NodeKit platform conformance — CI

**Where:** `.github/workflows/node-platform-conformance.yml` calls a reusable
workflow in `HomenShum/NodeKit`, which reads `nodekit.yaml` and checks the
repository contract.

`nodekit.yaml` declares five commands — `dev`, `demo`, `doctor`, `check`,
`proof` — and each must exist in `package.json`. Renaming one of those scripts
breaks CI, which is why `proof` and `doctor` still exist as names even though
both now run the same demo entrypoint.

## Playwright and ffmpeg

`npm run capture` needs a Chromium download (`npx playwright install chromium`).
`scripts/record-graph-rail.mjs` additionally needs `ffmpeg` on `PATH`; it is the
only thing in the repository that does, and it is only used to regenerate the
README clip.
