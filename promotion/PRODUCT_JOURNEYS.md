# Canonical journeys — NodeMem

Three to five real workflows. Not feature tours: a journey is one person, one
goal, and the artifact they hold when it worked. These are the promotion loop's
work queue, exercised in order of importance.

**A journey with no browser evidence is unfinished**, regardless of test status.

NodeMem is a library, so it is judged under the `reduced` gate: its user-facing
surface is the quickstart and the demo. J1–J3 are terminal journeys and their
artifact is the terminal transcript; J4 is the only journey that renders in a
browser, and it is where conditions 1–10 are actually decided.

## Journey shape

Each journey states, in this order:

- **Persona and situation** — who arrived, and why today.
- **Goal** — what they want to be true when they leave.
- **Steps** — what they actually do, in the UI, in order.
- **Done when** — the observable artifact or state that proves completion.
- **Evidence** — path to the capture that shows it working. Empty until proven.

---

## J1 — "Show me it works before I install anything"

- **Persona and situation:** A developer evaluating three memory libraries in
  one afternoon. They will not `npm install` a stranger's package to find out
  whether it is worth an install. The README's very first command claims it
  needs nothing.
- **Goal:** Confirm, in under a minute and with zero dependencies on disk, that
  the detection actually detects and the dismissal actually sticks.
- **Steps:**
  1. `git clone` the repo, `cd` into it, install nothing.
  2. Run `node demo/runNodeMemDemo.mjs` (the file exists at that exact path;
     it imports `demo/nodeMemDemoCore.mjs` and touches no `node_modules`).
  3. Read the six checks it prints.
- **Done when:** The process exits 0 and prints `Pass: 6  Fail: 0` with
  `✓ PASSED`, including `✓ Dismissal learning works` and
  `✓ Classifier is deterministic`.
- **Evidence:** run 2026-08-13 — exit 0, `Pass: 6  Fail: 0`, transcript quoted
  in [PROMOTION_LOG.md](PROMOTION_LOG.md) baseline.

## J2 — "Walk me through every gate that can suppress a suggestion"

- **Persona and situation:** The same developer, now convinced enough to
  install. Their real fear is job-queue flooding, so the thing they need to see
  is not detection — it is *suppression*: policy off, disabled signal, duplicate
  entity, room quota, previously dismissed.
- **Goal:** Watch each suppression gate fire once, by name, with the reason
  string their own code would branch on.
- **Steps:**
  1. `npm install`.
  2. Run `npm run demo` (`tsx demo/runNodeMemDemo.ts`, which drives
     `src/core/scanOrchestrator.ts` through `src/adapters/inMemoryAdapter.ts`).
  3. Read Steps 1–6 of the output, one gate per step.
- **Done when:** Exit 0, `Pass=13  Fail=0`, and the transcript names
  `duplicate_entity`, `previously_dismissed`, `policy_off`, and
  `room_quota_exceeded` as distinct suppression reasons.
- **Evidence:** run 2026-08-13 — exit 0, `Pass=13 Fail=0 Total=13`,
  `✓ DEMO PASSED — all gates green`.

## J3 — "Prove the port contract before I write an adapter for my database"

- **Persona and situation:** An engineer who has decided to adopt NodeMem but
  runs Postgres, not Convex. The README says `MemoryStore` is an interface and
  the in-memory adapter is the reference implementation. Before they write a
  Postgres adapter, they want the reference exercised against the contract so
  they know what "correct" looks like.
- **Goal:** See every method of the port called and asserted, so the adapter
  they write has a spec.
- **Steps:**
  1. `npm run nodemem:in-memory:smoke` (`scripts/nodemem-in-memory-smoke.ts`,
     writes `docs/eval/nodemem-in-memory-smoke.json`).
  2. `npm run nodemem:convex:smoke` to confirm the Convex table definitions in
     `src/adapters/convexSchema.ts` export cleanly.
  3. `npm test` for the 27 unit tests over `src/core/`.
- **Done when:** All three exit 0 — in-memory smoke `PASS (10/10)`, convex
  smoke `PASS (7/7)`, vitest `27 passed`.
- **Evidence:** run 2026-08-13 — 10/10, 7/7, 27/27, all exit 0.

## J4 — "Show me on screen that noticing never draws a line" *(the browser journey)*

- **Persona and situation:** A product lead, not the engineer. They will not
  read a test name. They have been burned by a tool that quietly turned a
  guess into a fact on a diagram, and they want to watch the difference between
  *the system noticed this* and *a human confirmed this* with their own eyes.
- **Goal:** See noticed entities appear with no number and no connecting line,
  and see exactly one line appear at the moment — and only at the moment — a
  person clicks Confirm.
- **Steps:**
  1. Serve the repo and open `demo/graph-rail/index.html` (the capture script
     `scripts/capture-graph-rail.mjs` does this on an ephemeral port; for
     hands-on driving, any static server over the repo root works — see the
     baseline note about `npm run dev`).
  2. Watch the activity stream on the left log `noticed` / `suggested` /
     `ignored` per event.
  3. Look at the graph: every node dim, labelled "unknown — not measured",
     **no edges**.
  4. Click `Confirm` on one suggestion card (`[data-testid="confirm-suggestion"]`).
  5. Look again: exactly one faint traversal edge.
- **Done when:** Before the click, `session.getSnapshot()` reports
  `nodes > 0, edges === 0` and every node has `count === undefined`; after one
  click, `edges === 1` and its type is `traversal`, not `evidence`.
- **Evidence:** `evidence/desktop-1400-loaded.png` (3 nodes, 0 edges, 3
  suggestion cards), `evidence/keyboard-focus-confirm.png` (focus ring on
  Confirm), `evidence/desktop-after-keyboard-confirm.png` (1 edge after Enter).
  Also `node scripts/capture-graph-rail.mjs` → 5/5 checks, exit 0.
  Defect surfaces found while driving this journey: `evidence/mobile-375-fresh.png`,
  `evidence/cdn-blocked-no-error-state.png`.

## J5 — "I said no. Does it stay no?"

- **Persona and situation:** A room member who dismissed a company suggestion
  yesterday and does not want to see it again. This is the one behaviour that
  decides whether the feature is welcome or is nagware.
- **Goal:** Dismiss once; confirm the same entity is suppressed on the next
  scan, and confirm the dismissal changed the record without changing the
  picture.
- **Steps:**
  1. In the graph rail, click `Dismiss` on a suggestion card
     (`[data-testid="dismiss-suggestion"]` in `demo/graph-rail/main.js`, which
     calls `store.recordDismissal` and deliberately makes no graph mutation).
  2. In the terminal, run `npm run demo` and read Step 4.
- **Done when:** The card resolves to "dismissed — nothing changed", the graph
  edge count is unchanged, and the terminal reports
  `✓ Dismissed entity suppressed — previously_dismissed`.
- **Evidence:** terminal half proven 2026-08-13 (J2 run, Step 4). Browser half
  **not captured** — the Dismiss click was not driven this wave; see the
  baseline note. Treat J5 as partially drivable.

---

## Journeys every agent surface owes

If this product runs an agent on the user's behalf, at least one journey must
exercise each of these, because they are where agent products fail a stranger:

- **Recovery** — **applies, and is missing.** NodeMem itself never runs a job,
  but the graph rail loads React, sigma and graphology from `esm.sh` at runtime.
  On a network that blocks the CDN the surface degrades to a blank frame with no
  message and no retry, and the user cannot get back to a good state without
  guessing. Logged as D2; no journey can pass it today.
- **Steering** — **J5.** Dismiss is the steering control: the correction is
  recorded and visibly takes effect on the next scan
  (`previously_dismissed`).
- **Receipt** — **J2 and J4.** Every suppression prints the reason that caused
  it, and the rail logs one line per event distinguishing `noticed` (no
  evidence) from `confirmed` (a human hop). `scripts/nodemem-smoke.ts` writes a
  machine-readable receipt to `docs/eval/nodemem-smoke.json`.
- **Approval** — deliberately *not* an agent-approval journey in the usual
  sense: NodeMem's whole doctrine is that it creates suggestions, never jobs,
  so there is no in-flight agent run to interrupt. The Confirm button in J4 is
  the approval surface, and it draws a line — it does not launch anything.
