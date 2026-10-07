# Web Interface Guidelines review — `demo/graph-rail/index.html`

Condition 7 of [the PROMOTION gate](https://github.com/HomenShum/NodeKit/blob/main/templates/promotion/GATE.md):
*Web Interface Guidelines review: no major unresolved finding.*

**Checklist:** the Vercel Web Interface Guidelines, <https://vercel.com/design/guidelines>,
fetched 2026-08-13 (reachable; nothing was substituted).
**Surface reviewed:** the one browser surface this repo has — the graph rail,
served by `npm run dev` and by every capture script through `scripts/serve.mjs`.
**Widths:** 320, 375, 412, 768, 1440. 412 is Lighthouse's mobile preset; 320 is
the narrowest width Wave 1's ledger reproduced D1 at, kept so the fix is measured
against the original reproduction rather than a subset of it.

**A review is not an audit, and neither substitutes for the other.** Lighthouse
and axe decide condition 8 and live in `scripts/audit-web-quality.mjs`. Nothing
in this file quotes a Lighthouse score as evidence for a guideline; where the two
overlap (contrast, CLS) the overlap is named.

## How to re-run it

    node scripts/wig-review.mjs             # → promotion/evidence/audit/wig-review.json + wig-*.png
    node scripts/wig-review.mjs --tag=before  # same reviewer, whatever page is on disk

The script measures one DOM fact per guideline and exits 1 while any major
stands. It does not judge — the verdicts below are the judgement; the JSON is the
measurement each one rests on. Rules that cannot apply to a page with no form, no
navigation and six fixture events are recorded `n/a` **with the reason**, because
a checklist that silently drops rules is how a review gets weakened.

## Result

| | before | after |
|---|---|---|
| major | **8** | **0** |
| minor | 12 | 6 |
| pass | 12 | 26 |
| n/a | 6 | 6 |

Artifacts: `evidence/audit/wig-review-before.json` and
`evidence/audit/wig-review.json`, with `evidence/audit/wig-before-*.png` and
`evidence/audit/wig-*.png` at each width.

## The eight major findings, and what closed each

### 1–3. Horizontal overflow at every mobile width
**Guideline:** Layout § *Responsive coverage*, Layout § *No excessive scrollbars*.
**Measured before:** `documentElement.scrollWidth` 524 against `clientWidth`
320 / 375 / 412 — **204px, 149px and 112px off-screen**.
`evidence/audit/wig-before-375.png`.
**Cause:** `#layout` was `grid-template-columns: 380px 1fr` with no media query at
any width, so the 380px rail took the space and the graph took what was left.
**Fix:** one media query at `max-width: 767px` — one column.
**Measured after:** `scrollWidth === clientWidth` at all five widths.
`evidence/audit/wig-375.png`.

> Wave 1's ledger recorded 567/320 (247px over) at this width; this reviewer
> measures 524/320 (204px over) on the same defect. The page gained a loading row
> and an alert panel between the two runs. The defect is the same defect; the
> number is this tree's.

### 4–6. The graph pane — the point of the page — was 114px wide
**Guideline:** Layout § *Responsive coverage* ("test mobile, laptop, ultra-wide").
**Measured before:** computed `#layout` columns `380px 114.281px`, `#stage` 114px
at 320, 375 and 412. The rail was legible and the thing it describes was not.
**Fix:** same media query.
**Measured after:** `#stage` 288 / 343 / 380 / 342 / 846px at 320 / 375 / 412 /
768 / 1440.

### 7. The activity log streamed with no live region
**Guideline:** Interactions § *Announce async updates* ("use polite aria-live").
**Measured before:** `#log` appends a row per pipeline event over ~2 seconds and
carried no `aria-live`, `role="log"` or `role="status"`. The page's only live
region was the boot-error alert, which is hidden on the success path — so a
screen-reader user heard nothing at all on a page whose entire content arrives
after load.
**Fix:** `role="log" aria-live="polite" aria-relevant="additions"` on `#log`.
**Measured after:** `#log is a live region`.

### 8. The primary output surface had no accessible name
**Guideline:** Content § *Accessible content* ("set accurate names, hide
decoration, verify the tree").
**Measured before:** 8 `<canvas>` elements, **0** carrying `aria-label`, `role`
or text; `#stage` had no role and no name. This is Wave 1's D6.
**Fix:** `role="figure"` plus an `aria-label` on `#stage` naming what the graphic
shows and pointing at the activity stream, which narrates the same events as
text.
**Measured after:** `#stage role=figure aria-label=set`.

> **First attempt was `role="img"`, and the audit caught it.** `img` makes its
> children presentational, and NodeGraph renders a "fit" button and type filters
> inside that box — axe reported `nested-interactive`, *serious*, one node. That
> is a regression this review introduced and the condition-8 audit rejected
> before it could be committed. `figure` names the graphic and leaves the
> controls reachable.

## Minor findings, left open and disclosed

| Guideline | Measurement | Why it is not major |
|---|---|---|
| Interactions § *Match visual & hit targets* (44px on mobile) | NodeGraph's `fit` chip is 27×44 at ≤412 — tall enough, 17px narrow | Width only, on a vendor control (`vendor/nodegraph-live/NodeGraph.js`) that sets its own inline padding. The page's own controls are ≥44px. A `min-height` here already lifted it from 27×18 |
| Content § *Headings & skip link* | `H1>H2>H2>H3` | The H3 is NodeGraph's own "Relationship graph" heading inside the figure. Order is not broken, it is nested |
| Content § *Headings & skip link* | no skip link | One screen, no navigation to skip past |
| Animations § *Honor `prefers-reduced-motion`* | page renders and completes under `prefers-reduced-motion: reduce` (3 nodes) but the sigma force layout still animates — no reduced variant is branched | The animation is the layout settling, not decoration, and it stops on its own. Recorded as the one real motion debt: a reduced-motion path would need the vendor to accept a static layout. `evidence/audit/wig-reduced-motion.png` |

## Rules recorded `n/a`, with the reason

- **Forms (whole section)** — no `form`, `input`, `textarea` or `select` on the page.
- **Interactions § URL as state / Deep-link everything** — one screen; no filters,
  tabs or pagination to encode.
- **Interactions § Optimistic updates** — Confirm mutates in-process state; there
  is no server round trip to be optimistic about.
- **Interactions § Confirm destructive actions** — Dismiss *is* the correction
  control and is non-destructive by design: it records a dismissal and mutates no
  graph. Nothing on this page deletes anything.
- **Content § Stable skeletons** — no skeletons; the loading state is a labelled
  status row (`#boot-status`).
- **Performance § Large lists** — the log is bounded by `DEMO_EVENTS` (6 fixtures).
