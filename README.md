# NodeMem

### Notice passively. Act explicitly.

NodeMem is a provider-agnostic passive memory component for agent systems. It notices entities in activity streams, surfaces noteworthy suggestions, learns from dismissals, and deduplicates — without auto-executing jobs.

> **Convex is one proof, not the only one.**

The core is pure TypeScript with zero provider dependencies. Bring your own backend.

---

## Why this exists

Most agent memory systems either:

- **Auto-execute** on every detected entity, flooding job queues and starving foreground work.
- **Remember nothing**, re-suggesting the same dismissed entities endlessly.
- **Tie you to one provider** — Convex, OpenAI, Pinecone — with no escape hatch.

NodeMem fixes all three:

1. **Passive doctrine**: detection creates *suggestions*, not jobs. The caller decides whether to promote.
2. **Dismissal learning**: entities dismissed by users are suppressed in future scans.
3. **Provider-agnostic ports**: `MemoryStore` is an interface. Convex, SQLite, Postgres, in-memory — your choice.

---

## What it does

```
Activity stream → Debounce → Classify → Policy gate → Quota check → Dedup check → Dismissal check → Noteworthy suggestion
```

- **Entity detection**: Companies, people, finance signals, research signals, URLs, open tasks — deterministic regex classifier, no LLM calls.
- **Signal scoring**: 6 stable signal enums, scored 0.18 per signal. Thresholds: `start_research_job` (≥0.70), `create_coach_cue` (≥0.50), `index_only` (≥0.35), `ignore` (<0.35).
- **Per-room quotas**: Cap noteworthy suggestions per room per hour. Prevents inbox flooding.
- **Entity dedup**: If an active noteworthy suggestion for the same entity exists, new detections are suppressed.
- **Dismissal learning**: Users dismiss entities → future scans suppress them. Entity-level and signal-scoped.
- **Assistive policies**: Per-room modes: `off`, `suggestions_only`, `ask_before_research`, `approved_watchlist_only`. Most restrictive wins.
- **Sliding-window debounce**: Coalesces rapid activity from the same source + actor into a single scan.

---

## Quick start

### Zero-dependency demo (no install)

```bash
node demo/runNodeMemDemo.mjs
```

### Full demo with TypeScript

```bash
npm install
npm run demo
```

### Run tests

```bash
npm install
npm test
```

### Run smoke checks

```bash
npm run nodemem:smoke
npm run nodemem:in-memory:smoke
npm run nodemem:convex:smoke
```

---

## Architecture

```
src/
  index.ts                    # Public API barrel
  core/
    classifier.ts             # Pure: entity + signal detection from text
    dedup.ts                  # Pure: duplicate entity + per-room quota checks
    dismissalLearner.ts       # Pure: entity dismissal tracking + suppression
    policyResolver.ts         # Pure: assistive policy resolution (most restrictive wins)
    dedupeKey.ts              # Pure: deterministic activity dedupe keys
    debouncer.ts              # Pure: sliding-window debounce logic
    scanOrchestrator.ts       # Orchestrates: classify → policy → quota → dedup → dismiss → noteworthy
  adapters/
    inMemoryAdapter.ts        # Zero-dependency reference MemoryStore implementation
    convexSchema.ts           # Convex table definitions (drop into your convex/ dir)
```

### Port contract

```typescript
interface MemoryStore extends DismissalStore, DedupStore, PolicyStore {
  patchRow(id: string, patch: { status: ActivityStatus; finding?: NoteworthyFinding; updatedAt: number }): Promise<void>;
}
```

Implement this single interface with any backend. The in-memory adapter is the reference.

---

## Using with Convex

1. Copy `src/adapters/convexSchema.ts` into your `convex/` directory.
2. Merge the table definitions into your `schema.ts`:

```typescript
import { roomActivityOutbox, roomDismissedEntities, roomAssistivePolicies } from "./nodemem/schema.js";

export default defineSchema({
  // ... your existing tables
  roomActivityOutbox,
  roomDismissedEntities,
  roomAssistivePolicies,
});
```

3. Implement `MemoryStore` against Convex's `MutationCtx` / `QueryCtx`.

---

## Using with any backend

```typescript
import { scanActivity, type MemoryStore } from "nodemem";

// Implement the port
class MyStore implements MemoryStore {
  // ... your backend queries
}

const store = new MyStore();
const result = await scanActivity(store, {
  id: "row-1",
  roomId: "room-1",
  sourceKind: "message",
  sourceId: "msg-1",
  sourceHash: "abc123",
  text: "Met with CardioNova about their Series A funding raise.",
  visibility: "room",
});

if (result.status === "noteworthy") {
  // Show suggestion to user. Do NOT auto-create a job.
  console.log(`Noteworthy: ${result.finding?.entities[0]?.displayName}`);
}
```

---

## Doctrine

> **Notice passively, act explicitly.**
> **Passive should create options, not jobs.**

NodeMem detects what's noteworthy and surfaces it as a suggestion. The user — or an explicit approval workflow — decides whether to act. This prevents:

- Job queue saturation from passive auto-execution
- Infinite retry loops on budget-limited free routes
- Duplicate suggestions for the same entity
- Re-suggesting entities the user already dismissed

---

## Signals

| Signal | Enum | Trigger |
|--------|------|---------|
| Organization candidate | `organization_candidate` | Capitalized multi-word name or suffix match (Inc, Labs, Bio, etc.) |
| Finance signal | `finance_signal` | Series A/B, seed, funding, raise, runway, burn, ARR, revenue, EBITDA, margin, cash |
| Person interaction | `person_or_interaction` | Met, spoke, talked, call, founder, CEO, CFO, contact, intro, emailed |
| Research signal | `research_signal` | Product, launch, announced, customer, pilot, hospital, pricing, competitor, market, news |
| Open question / task | `open_question_or_task` | Verify, source, follow up, ask, research, find, confirm, todo, next step, reference |
| Source URL | `source_url` | `https://` URL |

---

## Assistive modes

| Mode | Behavior |
|------|----------|
| `off` | All passive detection suppressed. |
| `suggestions_only` | Default. Suggestions surface in inbox, no auto-jobs. |
| `ask_before_research` | Suggestions surface, user must approve before any research. |
| `approved_watchlist_only` | Only entities on the approved watchlist get suggestions. |

Most restrictive setting wins across system default → room policy.

---

## Project structure

```
NodeMem/
├── src/
│   ├── index.ts
│   ├── core/
│   │   ├── classifier.ts
│   │   ├── dedup.ts
│   │   ├── dismissalLearner.ts
│   │   ├── policyResolver.ts
│   │   ├── dedupeKey.ts
│   │   ├── debouncer.ts
│   │   └── scanOrchestrator.ts
│   └── adapters/
│       ├── inMemoryAdapter.ts
│       └── convexSchema.ts
├── tests/
│   ├── classifier.test.ts
│   └── scanOrchestrator.test.ts
├── demo/
│   ├── runNodeMemDemo.ts
│   ├── runNodeMemDemo.mjs      # zero-dependency
│   └── demo-runner.ts
├── scripts/
│   ├── nodemem-smoke.ts
│   ├── nodemem-in-memory-smoke.ts
│   ├── nodemem-convex-smoke.ts
│   └── secret-scan.mjs
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## License

MIT © Homen Shum
