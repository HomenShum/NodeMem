# NODEMEM-MOBILE-STATE-02: pre-edit UI boundary

A developer opening the fixed memory demo on a phone must see whether startup is waiting, then inspect a suggestion and explicitly confirm or dismiss it. The current initial viewport is a blank reserved graph box; its loading message is below the fold. These are actual current-source browser captures, not reconstructed states.

- Route: /demo/graph-rail/index.html; anonymous local Chromium, dark theme, fixed built-in DEMO_EVENTS; no provider or authenticated session.
- Before source: clean HEAD 10ed013a9f2dd4729a0959bb6077a7bb8bb716c5. report.json binds the current source hashes and observed browser version.
- Exact viewports: 390x844, 320x800, 768x1024, 1440x960. Each has imports paused/loading, noticed at scrollY 0, natural Tab/Enter review and Confirm, Dismiss, blocked CDN and keyboard Retry. Raw DOM, accessibility, measurements and full/viewport screenshots are retained. The overlays are actual DOM overlays with 3px borders, removed after capture.
- Original unchanged harness: baseline-199/report.json, 199 passing checks / 53 captures, including current-frame labels, actual keyboard Fit, duplicate actions and 60-second session.

## CHANGE A: visible startup status and graph stage

Measured outer stage: 622px everywhere. Rendered graph: 461px noticed and 483px confirmed at 320/390; 441/463px at 768; 421/443px at 1440. The startup text begins at y1030 at 390 and y1068 at 320, outside their initial viewports.

Frozen sizing decision: reserve a 500px outer graph area from the first paint, make its existing root/renderer fill that same area, and let the existing canvas wrapper flex within the remaining space. This exceeds the measured largest fixed-fixture renderer (483px) while removing the unused 139–201px strip. It keeps graph-first ordering and a stable area during imports and fixed-fixture decisions. No renderer/vendor JavaScript changes or memory semantics change. The single existing boot-status element moves into the stage as an inset status; existing module-success and boot-error removal continue to own its lifecycle. The figure description will use direction-neutral activity-stream wording.

## CHANGE B: caption-to-decision flow

The caption and lower mobile rail move upward only as a consequence of the smaller stable graph area. Caption content, pipeline text, suggestion descriptions and provenance are unchanged. Desktop rail position/content remain protected. This is a spacing repair, not new navigation or a typography redesign.

| State | Expected visible behavior |
| --- | --- |
| Empty / imports paused | One honest loading message inside the graph reservation and initial mobile viewport; no fabricated graph or progress |
| Noticed | Same three unmeasured nodes, no edges, labels readable in current rendered frame; no unused stage strip |
| Confirmed | Explicit user confirmation creates one traversal edge and focuses the readable outcome; stable stage |
| Dismissed | Same graph as confirmed state; focus reaches readable dismissal outcome; no assertion |
| Error | Existing cause, Retry and terminal fallback; stage/caption hidden, loading status removed |
| Retry / reload | Existing fresh passive fixture and truthful reset disclosure |
| Narrow / enlargement | All seven required widths, label Fit, keyboard route and 200% DOM text scenario preserved; actual browser zoom remains separate |
| Loading-to-populated transition | Observe layout-shift entries and session-window CLS <=0.1; report raw input-excluded and total values rather than infer from a reserved height |

Protected: fixed inputs/reload disclosure; Review suggestions link and natural focus; Confirm/Dismiss authority; source provenance; graph labels/current-frame recorder; pipeline log content; desktop neighboring rail; vendor, backend, fixture and memory library. Allowed code files: demo/graph-rail/index.html and scripts/verify-ui-repair.mjs; HANDOFF and new scoped evidence only.

No full dimension grade, human usability, physical device, live provider, host activation, production or Lighthouse claim follows. The fresh independent judge must review exact after bytes and before/after pixels before commit/push.
