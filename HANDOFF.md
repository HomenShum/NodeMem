# NodeMem developer handoff

Read this file first, then the README and the [UI repair boundary](evidence/nodemem-ui-repair-20260905/before/change-boundary.md). A developer evaluating passive memory should be able to inspect a suggestion, choose whether to act, and understand what the demo remembers. NodeMem notices activity and offers suggestions; explicit confirmation alone draws a traversal edge. This demo does not create a measured assertion, launch a job, or persist its decisions across reloads.

The September 5, 2026 fixed-fixture UI repair was independently verified with caveats and committed locally as `da9ca34d17514e93cb5f5f694fd46398271f01f5`, based on canonical main `831180554062736cb4e9a79eddbade5ee2ef31e1` on `codex/portfolio-readiness-20260904`. The prior divergent adoption branch remains preserved. The following development-dependency and proof-recorder repair is a separate staged candidate awaiting its own fresh judge. Neither result is a release or full product-readiness claim.

## Reproduce locally

Use the committed lockfile with Node 22.22.2 (the observed Windows proof runtime; package minimum is Node 20):

```powershell
npm ci
npx playwright install chromium
npm run check
npm run capture
node scripts/verify-ui-repair.mjs
npm run dev
```

Open the printed `/demo/graph-rail/index.html` URL. React, graphology and Sigma load from the pinned public import map on esm.sh; no provider credentials are needed. A blocked CDN must show its cause and Retry. The pipeline also has a zero-install terminal path, `node demo/runNodeMemDemo.mjs`.

The focused browser command creates a new timestamped directory under `evidence/nodemem-ui-repair-20260905/runs`; its optional first argument selects a new output directory. The source/config hashes, actual assertions, DOM, accessibility output and screenshots are retained together. `npm run check` writes the existing pipeline receipt; `npm run capture` refreshes the existing README/promotion images. Preserve historical receipts before choosing to replace or commit generated outputs.

## September 5 repair record

- Resolved cards keep readable explanation/status text. After Confirm or Dismiss, keyboard focus moves to the outcome and the next Tab continues through the remaining controls.
- The introductory copy states that the fixed demo resets on reload. “Review suggestions” provides direct keyboard/pointer access from the first viewport. The stable graph reservation remains, preserving the earlier layout-shift design.
- The vendored renderer uses its existing Fit padding and label-grid settings to keep the fixed-fixture entity labels readable at narrow widths. [Vendor provenance](vendor/nodegraph-live/README.md) explicitly identifies this local patch and the older source map.
- The first repair proof is retained because it exposed label suppression at 320px. It also used programmatic focus for the implicitly keyboard-focusable log; the corrected proof uses actual sequential Tab followed by Home/End. The log's existing Chromium behavior was not a proven application defect.
- One pinned development dependency, axe-core 4.12.1, makes post-Confirm and post-Dismiss contrast checks reproducible. No library API, classifier, fixture, persistence, GraphSession, graph-model, provider or shared integration was changed.

## Technical follow-up awaiting review

The inherited development-only PostCSS and Nano ID advisories are addressed by compatible lock-only updates to 8.5.28 and 3.3.18. A normal locked install and audit passed with zero reported vulnerabilities at the recorded time. No package.json dependency/API change was needed. The browser recorder now clears old labels when Sigma clears its label canvas, stores the frame identity, and checks both axes. A real cleared-frame regression failed before and passes after; the actual fixture and keyboard Fit still pass.

The [technical receipt](evidence/nodemem-technical-repair-20260905/README.md) links the before/after regression, audit and new source-bound browser evidence: **199 checks, 53 captures**, plus the standard **81 tests and 13 pipeline gates**. Application UI, runtime, vendor source and earlier evidence bytes are unchanged in this follow-up. The current result remains worker evidence until the next independent judge reviews the staged bytes. The prior reduced-motion capture disagreement is still open; no motion-stability grade is inferred.

## Acceptance limits

The [historical UI worker report](evidence/nodemem-ui-repair-20260905/runs/2026-09-05T00-57-39.820Z/report.json) passes 198 checks across 53 captures on its exact 13 source/config hashes. Its fresh judge independently passed 112 checks across 30 states using a current-frame recorder and approved that named UI repair with caveats. Native capture passed 12 checks. This historical evidence is preserved; the changed recorder and development lockfile require the separate current run below.

The named worker proof is `E6B-NODEMEM-REPAIR-01`: six viewport widths, explicit decisions, actual focus continuity, label draw bounds and pixels after Fit, CDN failure/retry, 320px reflow, 200% DOM text enlargement, duplicate activation, a 60-second fixed-session observation and honest reload reset. Read the retained report before inheriting any passing result; a relevant source/config/dependency change invalidates it. DOM text enlargement is not physical browser zoom.

The existing axe log-focus warning is recorded separately from actual Chromium Tab/Home/End access. Full visual design, responsiveness, interaction, accessibility, performance, actual usage and goal-alignment grades remain open. Other browser engines, physical touch/devices, screen-reader participants, fresh-human usability, live providers, durable integrations and production are NOT_RUN. A fixed local demo pass does not certify the provider-agnostic library in another application's workload.
