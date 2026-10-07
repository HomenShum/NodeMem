# NodeMem mobile startup and space proof

A developer opening the fixed memory demo on a phone can see that startup is waiting, then use the existing review route to confirm or dismiss a suggestion. The repaired page keeps that feedback visible and uses its reserved graph area without changing what confirmation means.

**NODEMEM-MOBILE-STATE-02 · Worker verified, awaiting fresh independent judge.** Base: 10ed013a9f2dd4729a0959bb6077a7bb8bb716c5. No commit, push, host activation or deployment is certified here.

## Read and reproduce

Read [the pre-edit boundary](before/change-boundary.md) and [its actual annotated screenshot](before/change-boundary.png), then [the final report](run-2026-09-05-clean-startup/report.json). From the repository root with locked dependencies installed, run:

```powershell
npm run check
npm run capture
node scripts/verify-ui-repair.mjs
```

The focused script writes a NEW timestamped directory and refuses an existing output path. It replays the preserved [before HTML](before/source-index.html) only for the clean startup comparison, with the same unchanged runtime/vendor files. The genuine pre-edit boundary captures remain separate from this later controlled replay. Check/capture rewrite their existing outputs; preserve them before rerunning. This worker retained the newly generated outputs under validation and restored the previous tracked artifacts byte for byte.

## Result and evidence

- The original harness passed unchanged both before and after the page repair: 199 checks / 53 captures in each run. Intermediate raw runs are retained in operator custody with file hashes; they are not the final source-bound report.
- The final scenario passes **350 checks**, with **61 recorded state captures** across all seven widths and **14 separate clean startup runs**. It includes initial loading, noticed, Confirm, Dismiss, keyboard Fit, blocked CDN/Retry, duplicate activation, 60 seconds of stable resolved state, reload reset and 200% DOM text enlargement.
- The stage is 500px from initial loading through the fixed-fixture outcomes. Its renderer fills the inner 498px. The single boot-status element is visible inside it and is removed by the existing successful/error lifecycle. The caption and lower mobile flow move upward by 122px; desktop activity content/order are protected.
- At every width the actual clean startup CLS equals the preserved-before value. No input, resize, screenshots or axe injection occurs before those measurements finish. Mobile 320/360/390: **0**; 768: **0.0266512**; 1024: **0.0241539**; 1440: **0.0107601**; 1920: **0.00538005**. All are within the unchanged **0.1** threshold. These are local startup observations, not field metrics.
- The earlier screenshot-heavy pass reported shifts tagged as recent input. Those raw entries remain retained, but clean startup runs above are the performance evidence. The harness records both all shift values and input-excluded session CLS.
- Natural Tab/Enter reaches the direct review link and Confirm; outcome focus, next Tab, Dismiss, explicit traversal meaning and all fixed-fixture current-frame labels remain supported. Enlarged DOM text leaves a non-collapsed canvas and reachable decisions; this is not actual browser zoom.
- Standard check initially caught stale HTML line citations. Only eight numeric references were updated across the walkthrough, promotion log and debug tour; original failure and exact unchanged cited-snippet hashes remain in the operator receipt. No test threshold or promotion statement changed.

Useful same-state comparisons: [before loading at 390](before/390x844-loading-viewport.png), [after loading at 390](run-2026-09-05-clean-startup/390x844-loading-viewport.png), [before noticed at 390](before/390x844-noticed-viewport.png), [after noticed at 390](run-2026-09-05-clean-startup/390x844-noticed-viewport.png), [after focused confirmation at 320](run-2026-09-05-clean-startup/320x800-confirmed-viewport.png), [after error at 320](run-2026-09-05-clean-startup/320x800-error-viewport.png), and [enlarged DOM text](run-2026-09-05-clean-startup/text-200pct-390.png).

## Honest limits

This is a dark, fixed-input demo in the recorded local Chromium build. It does not certify full visual/design/responsiveness/interaction/accessibility/performance/usage/goal-alignment grades. All overall and dimension grades remain OPEN/null. Mobile information density, the existing axe/manual log-focus disagreement, motion, real zoom, screen readers, physical devices, constrained platforms and fresh-human comprehension remain separate work. No Lighthouse, model/provider call, host hook, durable integration or production result is inferred. Original refs, previous evidence and runtime/vendor/library files remain preserved; source/installed dependencies and artifact hashes are bound in the operator receipt.
