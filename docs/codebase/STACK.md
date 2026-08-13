# Stack

Deliberately small. One runtime dependency, five development ones, no bundler,
no framework, no database of its own.

| Thing | Version | Why it is here |
|---|---|---|
| Node | `>=20` (`package.json` engines); measured on v22.22.2 | Runs the demos, the tests, and the static server |
| TypeScript | `^5.7.2` | The library is TypeScript; `npm run typecheck` is `tsc --noEmit` — there is no build output |
| Vitest | `^4.1.10` | The test runner (`vitest.config.ts`, `tests/**/*.test.ts`) |
| tsx | `^4.19.2` | Runs the TypeScript demo without a build step |
| Playwright | `^1.62.1` | Drives the real browser in `scripts/capture-graph-rail.mjs` and `scripts/record-graph-rail.mjs` |
| convex | `^1.41.0` | **The only runtime dependency.** Used by exactly one file, `src/adapters/convexSchema.ts`, to declare tables with `defineTable`/`v` |

## What is deliberately absent

- **No bundler.** `demo/graph-rail/index.html` loads React, graphology and sigma
  from `esm.sh` through an importmap at run time. That is why the page has a
  boot-failure guard (see `ARCHITECTURE.md`).
- **No build artifact.** `tsc` runs with `noEmit`. Consumers of this package
  would import the TypeScript source; there is no `dist/`.
- **No linter or formatter.** Style is whatever the file already does.
- **No LLM.** `grep -rn "openai\|anthropic\|fetch(" src/` returns nothing. Every
  decision in `src/` is a regular expression and a comparison.

## Vendored, not installed

`vendor/nodegraph-live/` is a built copy of
[`@homenshum/nodegraph-live`](https://github.com/HomenShum/NodeGraph), used only
by the browser demo. Its own README states the copy retires when the package is
published to npm. Static-analysis tools report these files as unused because the
only importer is `demo/graph-rail/main.js`, which is itself loaded by an HTML
`<script>` tag rather than by anything in `package.json`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Serves the repository; prints the graph-rail URL. `PORT` overrides 5173 |
| `npm run demo` | The whole pipeline in the terminal, 13 checks |
| `npm run demo:node` | The same story with no install and no build — plain `node` |
| `npm run proof` / `npm run doctor` | `demo` plus a JSON receipt at `docs/eval/nodemem-smoke.json` |
| `npm run capture` | Playwright gate over the rendered page, 12 checks |
| `npm test` / `npm run test:watch` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run secret-scan` | Regex sweep of `src`, `tests`, `demo`, `scripts` |
| `npm run check` | secret-scan, typecheck, tests, proof — the pre-push gate |

`nodekit.yaml` declares `dev`, `demo`, `doctor`, `check` and `proof`; those five
names are load-bearing for the platform conformance workflow and should not be
renamed casually.
