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

## Defect ledger

Open defects, most-impactful first. A defect is only listed once it has a
reproduction; a hunch is not a defect. **None of these were fixed** — Wave 1
measures.

| # | Severity | Journey | Reproduction | Status |
|---|----------|---------|--------------|--------|
| D1 | Major | J4 | Serve repo root; open `/demo/graph-rail/index.html` at viewport width 375×812 and load fresh. `#layout` computes `grid-template-columns: 380px 114.281px` (no media query exists in the file), `document.scrollWidth` 567 vs `clientWidth` 375 — 192px of horizontal overflow; the graph pane, the entire point of the page, is 114px wide and off-screen. Reproduces at 390 (177px over) and 320 (247px over); clean at 768, 1024, 1400. `evidence/mobile-375-fresh.png` | open |
| D2 | Major | J4 / Recovery | Load the same page with all `**esm.sh**` requests aborted (any network that blocks the CDN in the `<head>` importmap: react, react-dom, graphology, sigma, @sigma/node-border). Result after 4s: log has 0 children, 0 suggestion cards, 0 `<canvas>`, **0 page errors, 0 console errors** — and the caption still describes a graph that is not there. Regex `/error\|failed\|retry\|offline\|could not/i` over `body.innerText` → false. The user sees a blank frame with confident prose and no way back. `evidence/cdn-blocked-no-error-state.png` | open |
| D3 | Major | J4 | `npm run dev` — declared in `nodekit.yaml` as `commands.dev: { script: dev, mode: service }` — runs `vite` over a repo with **no root `index.html`** and with react/sigma/graphology present only in the browser importmap, never in `package.json`. Measured: `GET http://localhost:5999/` → **404**; `GET /vendor/nodegraph-live/NodeGraph.js` → **500** ("Failed to resolve import … Are they installed?"). Also note `vite` itself is not a declared dependency — it resolves only transitively through `vitest`. A stranger following the standard verb gets nothing. | open |
| D4 | Major | J1 / install | `package.json` declares `"bin": { "nodemem": "./bin/nodemem.mjs" }`. `fs.existsSync('./bin/nodemem.mjs')` → **false**; there is no `bin/` directory in the repo at `ac8e7db`. Any `npm i -g nodemem` / `npx nodemem` creates a broken shim. | open |
| D5 | Minor | J4 | Every node in the rail reads "unknown — not measured" forever. `docs/GRAPH_INTEGRATION.md:123` specifies `countNoteworthyForEntity(roomId, entityKey): Promise<number>` on `DedupStore`; `grep -rn countNoteworthyForEntity src/` → **no match**. The data exists (`listNoteworthy` + `NoteworthyRow.entityNames` in `src/core/dedup.ts`, rows held in `src/adapters/inMemoryAdapter.ts`) and `EntityRef.count` in `vendor/nodegraph-live/session.d.ts` is waiting for it — the method was simply never added. This is the known API gap named in the wave brief. | open |
| D6 | Minor | J4 / a11y | On the loaded rail: 8 `<canvas>` elements, **0** carrying `aria-label`, `role`, or text content; **0** elements with `aria-live`/`role=status`/`role=log` despite the activity log appending rows asynchronously. Keyboard itself is fine (Confirm reachable in 2 Tabs, visible focus ring, Enter works). A screen-reader user gets the headings and nothing else. | open |

## Iterations

_none — Wave 1 is baseline only._
