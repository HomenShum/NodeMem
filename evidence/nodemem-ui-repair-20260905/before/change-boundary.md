# UI change boundary

Named proof: E6B-NODEMEM-REPAIR-01. This patch repairs five observed demo usability problems; it does not add persistence or alter passive-memory authority.

Route: /demo/graph-rail/index.html. Primary boundary viewport: 390x844; companion untouched captures: 360x800, 768x1024, 1024x768, 1440x960, 1920x1080. Theme: the existing dark theme. Session: new isolated local fixed-fixture Chromium session. Trigger: load and wait for the existing four DEMO_EVENTS to finish, without confirming. Fixture: demo/nodeMemDemoCore.mjs at main 831180554062736cb4e9a79eddbade5ee2ef31e1. Baseline was served from the untouched canonical consumer; no original screenshot was reconstructed. The overlay consists of three 3px yellow boxes added to this live browser DOM only. Source files were unchanged.

[Before](before.png) and [annotated boundary](change-boundary.png) are the scope oracle. Baseline Enter and Space both left BODY focused. Recorded canvas draw bounds put CardioNova 34.66 pixels outside the narrow canvas.

## CHANGE A · Session / decisions

Current: the introductory paragraph describes shared implementation but does not state the demonstration resets, or offer direct access to the decisions.
Expected: a short fixed-input/session-only reset disclosure and a keyboard/pointer link to the suggestions. Preserve the page title, doctrine and graph semantics. The existing stable graph reservation may remain: a direct decision route addresses action reachability without undoing the prior layout-shift fix.

## CHANGE B · Graph framing

Current: the renderer fits node centers with 44px padding, but CardioNova extends beyond the frame at narrow widths; Fit restores the same clipped view.
Expected: use the existing framing setting to reserve the measured label extent. Inspect all fixed-fixture label pixels and their canvas text bounds before and after keyboard Fit, at each supported width plus 320px. Keep the graph's node/edge values, unknown counts, filters and traversal/assertion distinction unchanged. No new public renderer API or persistent graph state.

## CHANGE C · Outcome / focus

Current: resolving a suggestion removes the focused button row and dims the entire card to 0.55 opacity.
Expected: explicit readable resolved text replaces the controls; focus moves to that outcome and the next Tab reaches the next meaningful control. The direct decision link can focus the existing suggestions region. Preserve user confirmation, dismissal-only graph behavior and the live log.

| State | Required observation |
| --- | --- |
| Loading / empty | Paused module shows existing loading row, no graph data or suggestions invented. |
| Noticed | Three fixture nodes, no edges, no measured counts; label text fits. |
| Confirm | One explicit traversal edge; readable outcome, visible keyboard focus, next Tab advances. |
| Dismiss | No node/edge change; readable dismissal outcome, focus continuity. |
| CDN error / retry | Existing named error and recovery work; unavailable graph/caption hidden. |
| Reload | Original fixtures and zero edges return, consistently with visible reset disclosure. |
| Responsive / overflow | Six exact widths and 320px reflow; labels fit after Fit; direct decision route operates; 200% text enlargement wraps without losing decisions. |
| Burst / sustained | Duplicate activation makes one edge; fixed completed state does not accumulate during 60-second observation. |

Out of scope: classifier/store/GraphSession logic, fixture events, caption doctrine, log semantics, provider use, graph selection/filters, new persistence, external jobs, production. Neighbor positions below the expanded introductory paragraph may move by that paragraph's added height; their styling/content must not change. The existing Chromium Tab/Home/End access to the log already works; the axe disagreement is not a repaired keyboard defect.

After proof must retain identical route, viewport, theme, fixture and trigger; named loading, error and populated screenshots, an actual before/after comparison, and after.md with unchanged assertions. Physical devices, actual browser zoom, other engines, screen-reader participants and fresh-human grading remain NOT_RUN.
