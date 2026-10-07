# NodeKit adoption

A developer adding passive memory to an application needs to distinguish a
suggestion from permission to start work. NodeMem classifies activity and applies
policy, deduplication, quota and dismissal gates. The host supplies storage and
decides whether an approved suggestion becomes a job.

This map complements [START_HERE.md](START_HERE.md) and
[HANDOFF.md](../HANDOFF.md). It describes declared ownership and existing source,
not a completed runtime migration or production certification.

## Declared boundaries

`nodekit.yaml` registers a `standalone-package`, owning `nodemem.memory` and
consuming the repository, event and certification contracts. NodeMem has no
product-agent definition. Its `ScanInput` and `MemoryStore` contracts serve a
host runtime; a canonical `nodeagent.event/v1` adapter remains unimplemented.

| Concern | Current implementation boundary |
| --- | --- |
| Passive classification, policy, deduplication and storage port | NodeMem source library; detection creates suggestions, not jobs |
| Storage | In-memory reference implementation; hosts implement `MemoryStore` for durable storage |
| Convex | Table/schema definitions and schema tests; no deployed backend verification |
| Certification | `proof.receiptSchema: null`; demo JSON is local evidence, not a `proofloop.receipt/v1` implementation |
| Package consumption | README's bare `nodemem` imports are API sketches; this checkout has no built npm entrypoint |

Keep explicit approval in the host. A finding whose suggested action is
`start_research_job` does not grant permission or execute that job.

## Existing commands

Use [package.json](../package.json) as the command source:

| Command | Actual scope |
| --- | --- |
| `npm run demo` | Run the TypeScript pipeline demo through the source library |
| `npm run proof` / `npm run doctor` | Run that same demo and write `docs/eval/nodemem-smoke.json` |
| `npm run check` | Secret scan, TypeScript check, Vitest suite and demo proof |
| `npm run dev` | Serve the separate browser graph demonstration |
| `npm run demo:node` | Run the separate zero-install JavaScript demo; it does not exercise the TypeScript library |

The demo receipt and schema tests do not establish live providers, durable host
integration, a canonical event adapter or sustained production performance.
The browser demo and current UI acceptance limits are recorded in HANDOFF.md.

With a sibling checkout directory named `NodeKit`, check the declared repository
contract using the existing CLI:

```bash
node ../NodeKit/src/cli.mjs repo check --repo-root .
```

Use the actual sibling path when it differs. Repository conformance is separate
from the application tests, rendered UI judgments and production readiness.
