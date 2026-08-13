# NODE-LOOPS.md — NodeMem

> This repo's self-improving-loop manifest. Companion to CLAUDE.md. Spec: https://github.com/HomenShum/noderl/blob/main/spec/node-loops.md

NodeMem is a **provider-agnostic passive-memory component for agent systems**. It notices entities in an activity stream, surfaces *noteworthy suggestions* (never auto-jobs), learns from dismissals, and deduplicates. The whole repo is built around one doctrine and one loop:

> **Notice passively, act explicitly. Passive should create options, not jobs.**

The "loop" here is not an LLM training loop — it is a **deterministic detect→gate→suggest pipeline whose feedback signal is human dismissal**. That is the system this manifest documents. Source of truth: [`README.md`](README.md), [`src/index.ts`](src/index.ts), [`src/core/scanOrchestrator.ts`](src/core/scanOrchestrator.ts).

---

## 1. Goal & milestones

**What "good" is here:** a memory substrate that surfaces the *right* entity exactly once, never floods the job queue, never re-suggests a thing the user already dismissed, and is portable across backends (Convex / SQLite / Postgres / in-memory) behind one `MemoryStore` port.

The three failure modes it explicitly fixes ([`README.md` → Why this exists](README.md)):
1. **Auto-execution flood** — most memory systems spawn a job per detected entity, starving foreground work. NodeMem creates *suggestions*, not jobs.
2. **No memory of "no"** — most systems re-suggest dismissed entities forever. NodeMem suppresses them.
3. **Provider lock-in** — `MemoryStore` is an interface; the core has zero provider deps.

**Milestone steps (observable in the repo):**
- M1 — Deterministic classifier ([`src/core/classifier.ts`](src/core/classifier.ts), version-pinned `noteworthy-v1`): text → `{ entities, signals, score, action }`, no LLM.
- M2 — Full gated scan pipeline ([`src/core/scanOrchestrator.ts`](src/core/scanOrchestrator.ts)): classify → policy → watchlist → quota → dedup → dismissal → `noteworthy`.
- M3 — Reference port impl ([`src/adapters/inMemoryAdapter.ts`](src/adapters/inMemoryAdapter.ts)) + Convex schema drop-in ([`src/adapters/convexSchema.ts`](src/adapters/convexSchema.ts)).
- M4 — Honesty gates: tests (51) + the pipeline proof receipt + secret scan, all wired into `check` ([`package.json`](package.json)); the browser gate `npm run capture` on top.

---

## 2. Inner loop (agent-status trace)

**The task:** given one activity row (a chat message, doc edit, cell, or note), decide its fate — surface it as a noteworthy suggestion, or suppress it with an honest reason.

**State / action / observation** (the orchestrator is the loop body, `scanActivity` (`src/core/scanOrchestrator.ts:101`)):
- **State** — the `MemoryStore` port: existing noteworthy rows, per-room quota counts, dismissed entities, room policy. All persistence delegated to the port; the loop itself is pure aside from store calls.
- **Action** — run the ordered gate pipeline and `patchRow(id, { status, finding, reason, updatedAt })`.
- **Observation** — `ScanResult { status, finding, reason, text }`. Terminal statuses: `noteworthy` (pass) or `not_noteworthy` (suppressed, with a reason).

**How it's traced:** every suppression carries a typed `reason` string — the trace IS the reason code. The ordered gates and their reasons ([`README.md` → Pipeline gates](README.md), confirmed in source):

| Gate | Suppress reason | Source |
|------|-----------------|--------|
| Not noteworthy (`score < 0.35` or `action==="ignore"`) | `not_noteworthy` | scanOrchestrator step 1 |
| Policy mode `off` | `policy_off` | step 3 |
| Disabled signal kind | `signal_disabled_by_policy` | step 4 |
| `approved_watchlist_only` + entity not listed | `not_on_watchlist` | step 5 |
| Per-room hourly quota exceeded | `room_quota_exceeded` | step 6 |
| Active suggestion already exists for entity | `duplicate_entity` | step 7 |
| Entity previously dismissed | `previously_dismissed` | step 8 |

**The JUDGE (separate verifier, not the actor):** `classifyNoteworthy` ([`src/core/classifier.ts`](src/core/classifier.ts)) is a **pure, deterministic, LLM-free** scorer — same input → same output — pinned to `CLASSIFIER_VERSION = "noteworthy-v1"` so taxonomy drift is detectable. It is decoupled from whatever agent/LLM produced the activity text; the thing that wrote the message does not get to grade its own noteworthiness. Scoring is mechanical: `0.18` per detected signal (6 signals, clamped to 1.0), thresholds `≥0.70 → start_research_job`, `≥0.50 → create_coach_cue`, `≥0.35 → index_only`, `<0.35 → ignore`.

**Reward signals (this turn):**
- `+` reaches `noteworthy` with a real entity and ≥1 signal.
- `−` suppressed for the *wrong* reason (e.g. a genuine entity hits `previously_dismissed` because the dismissal key was too broad) — caught by [`tests/scanOrchestrator.test.ts`](tests/scanOrchestrator.test.ts).
- `0` honest suppression (`policy_off`, `room_quota_exceeded`, `duplicate_entity`) — working as designed.

---

## 3. Outer loop (self-improve)

The outer loop is **human dismissal feeding back into future scans** — the only learning signal in the system, and it is honest (recorded by a real user/agent id, not synthesized).

- **How traces/failures feed back:** when a suggestion is wrong, the user dismisses it → `store.recordDismissal(roomId, entityNames, by)` ([`README.md` → Learn from dismissals](README.md)). The next scan of that entity in that room hits the `previously_dismissed` gate ([`src/core/scanOrchestrator.ts`](src/core/scanOrchestrator.ts), calling `DismissalStore.isEntityDismissed`). Suppression is durable, per-room, and learned — not hard-coded.
- **What gets edited:** room behavior is tuned via **assistive policy**, not code — `setRoomPolicy` ([`src/core/policyResolver.ts`](src/core/policyResolver.ts)) adjusts `mode`, `disabledSignalKinds`, `approvedEntityWatchlist`, `maxSuggestionsPerHour`. Policy resolution is **most-restrictive-wins** across system default → room policy.
- **Promotion gate:** a suggestion is *never* auto-promoted to a job. Promotion to a research job / coach cue is an **explicit caller decision** outside this repo (the doctrine boundary). The classifier's `action` is a *recommendation surface*, not an execution trigger.
- **Kill criteria:** policy `mode = "off"` kills all detection for a room; per-room hourly quota — `DEFAULT_MAX_PER_ROOM_PER_HOUR` (`src/core/scanOrchestrator.ts:58`), 10 unless the host passes its own — kills runaway suggestion volume; dedup kills repeat suggestions for a live entity.

When the classifier taxonomy itself changes, `CLASSIFIER_VERSION` is bumped — that is the self-heal hook for the judge: a version mismatch tells downstream consumers their cached findings are stale.

---

## 4. Context anchors

Grounded in real files in this repo:

- **Memory substrate** — the storage port `MemoryStore` (`src/core/ports.ts:76`), composed of `DismissalStore` + `DedupStore` + `PolicyStore` + `patchRow`. Reference implementation: [`src/adapters/inMemoryAdapter.ts`](src/adapters/inMemoryAdapter.ts) (zero-dep). Durable backend drop-in: [`src/adapters/convexSchema.ts`](src/adapters/convexSchema.ts) (tables `roomActivityOutbox`, `roomDismissedEntities`, `roomAssistivePolicies`).
- **Knowledge / signal layer** — [`src/core/classifier.ts`](src/core/classifier.ts): six stable signal enums (`SIGNAL`), a `STOP_NAMES` false-positive filter, evidence spans, and `facets` (`funding`, `runway_inputs`, `product_news`, `source_validation`, …) — the closest thing to an OKF/concept layer. **Finding: there is no embedding/RAG/vector layer** — detection is pure regex + deterministic scoring by design (provider-agnostic, zero-dep core). That is a deliberate scope choice, not an omission.
- **Codebase-graph note:** dedup/dismissal keys are deterministic ([`src/core/dedupeKey.ts`](src/core/dedupeKey.ts) `activityDedupeKey`; `normalizeEntityKey` in classifier), giving stable cross-row identity without a graph DB.
- **Key modules** — public API barrel [`src/index.ts`](src/index.ts); debounce [`src/core/debouncer.ts`](src/core/debouncer.ts) (`computeDebounce`, sliding window + maxWait cap); the pipeline and its dedup gate [`src/core/scanOrchestrator.ts`](src/core/scanOrchestrator.ts); the storage contract [`src/core/ports.ts`](src/core/ports.ts).
- **Eval gates** — the vitest suites in [`tests/`](tests/) (8 test files; see [`docs/codebase/TESTING.md`](docs/codebase/TESTING.md)); the pipeline proof [`demo/runNodeMemDemo.ts`](demo/runNodeMemDemo.ts) with `--json-out`; the browser gate [`scripts/capture-graph-rail.mjs`](scripts/capture-graph-rail.mjs); secret scan [`scripts/secret-scan.mjs`](scripts/secret-scan.mjs).

---

## 5. Verification protocol

- **Separate verifier:** the judge (`classifyNoteworthy`) is a different artifact from any text producer, and is deterministic — it cannot be talked into a higher score by the agent that wrote the text. Tests assert exact scores/actions/signals, so a taxonomy change that silently shifts a verdict fails CI.
- **No-proof-no-claim:** `npm run proof` emits a **JSON receipt** with `{ pass, fail, total, checks, status, timestamp }` ([`demo/runNodeMemDemo.ts`](demo/runNodeMemDemo.ts)); `process.exit(1)` on any fail. A green claim must point at a receipt, not a vibe. (Receipts are written to `docs/eval/*.json` on demand — see Status.)
- **Pre-push gate** ([`package.json`](package.json) `check`): `secret-scan && typecheck && test && proof`. Nothing ships without the secret scan, `tsc --noEmit`, the full vitest suite, and the 13-check pipeline proof passing.
- **Runtime reliability invariants (enforced in the loop, not aspirational):**
  - **Bounded:** per-room hourly quota (`maxPerRoomPerHour`, 10 unless the host passes its own) bounds suggestion volume; dedup bounds duplicates.
  - **Honest status:** suppression returns `not_noteworthy` with a typed `reason` — never a fake "success". The status enum is explicit: `ActivityStatus` (`src/core/ports.ts:18`).
  - **No SSRF / no external fetch:** the core makes **zero network calls** — it classifies text it is handed. URLs are detected as a `source_url` signal, never fetched. (External calls are gated to the *caller* via `allowExternalCalls` policy, outside this repo.)
  - **Bounded reads:** evidence spans are truncated (`span.slice(0, 200)`) in the classifier; no unbounded text retained per finding.
  - **No-clobber:** dedup checks for an existing active suggestion for the same entity *before* writing a new one (`findExistingNoteworthyForEntity`, excludes the current row id).
- **PROVE-BEFORE-CLAIM** (agent-side gate) — never assert done/pass/fixed/blocked/absent/"root cause" from a *proxy* (an affordance, a keyword/template echo, a rendered shell, or a prior-based hypothesis); name the artifact that proves it and check THAT, independent-confirm anything that "looks done", and treat no gate as real until the autonomous path is tried. Canonical gate + observed failure signals: https://github.com/HomenShum/noderl/blob/main/spec/prove-before-claim.md

---

## 6. Reward & safety

**Reward components:**
- Surfacing exactly one suggestion per genuinely-noteworthy entity (dedup + quota make the reward *sparse on purpose*).
- Honest suppression with the correct reason code (a suppression for the wrong reason is a defect, not a reward).
- Determinism: the demo explicitly checks "Classifier is deterministic" ([`README.md` → demo output](README.md)).

**Safety gates (each maps to a real mechanism):**
- **Budget / quota:** `room_quota_exceeded` + `maxApprovedBackgroundJobsPerDay` in policy — bounds spend and job volume.
- **Approval:** doctrine — suggestions never auto-promote; `ask_before_research` mode requires explicit user approval before any research; `allowExternalCalls` is policy-gated.
- **No-clobber:** dedup gate prevents stacking duplicate suggestions on the same live entity.
- **No foreground starvation:** the founding motivation — passive detection creates options, not jobs, so it cannot saturate the job queue or starve foreground work ([`README.md` → Doctrine](README.md)).
- **Secret hygiene:** [`scripts/secret-scan.mjs`](scripts/secret-scan.mjs) is the first link in `check`.

---

## 7. Status / receipts

**Where proof lives:** vitest suites in [`tests/`](tests/); the pipeline proof writes a JSON receipt to `docs/eval/nodemem-smoke.json` when run with `--json-out`; the browser gate writes screenshots to `assets/graph-rail/` and `promotion/evidence/`. The full gate is `npm run check`.

**PROVEN (mechanically, in-repo):**
- The unit suite is 8 test files and gates `check`.
- The full gate pipeline (classify → policy → watchlist → quota → dedup → dismissal) is implemented and each gate has a typed suppression reason — verified by reading [`src/core/scanOrchestrator.ts`](src/core/scanOrchestrator.ts).
- Deterministic, LLM-free classifier pinned to `noteworthy-v1`.
- The pipeline proof + secret scan are wired into `check` ([`package.json`](package.json)); the two adapter smokes became vitest suites in Wave 3 (see [`docs/SIMPLIFICATION_REPORT.md`](docs/SIMPLIFICATION_REPORT.md)).

**OPEN / honest gaps:**
- **No committed receipt artifacts:** `docs/eval/` does not exist in the repo at time of writing — smoke receipts are generated on demand, not checked in. There are **no committed benchmark scores or pass-rate numbers** beyond the illustrative demo output in the README (which is documentation, not a stored receipt). No fabricated metrics are claimed here.
- **CI runs the NodeKit platform conformance workflow only** ([`.github/workflows/node-platform-conformance.yml`](.github/workflows/node-platform-conformance.yml)); it checks the repository contract in `nodekit.yaml`, not the tests. `npm run check` is the gate, run locally.

The honest one-line status: **the loop and its gates are real and tested; the eval *receipts* are run-on-demand and not yet committed as artifacts.**
