# NodeKit adoption

NodeMem is registered as a NodeKit `standalone-package` and maps its existing
provider-neutral memory core, in-memory adapter, and Convex schema adapter without
reorganizing working source code.

## Current conformance level

- **L1 registered:** `nodekit.yaml` declares repository identity, ownership,
  lifecycle commands, no-key behavior, environment status, and the current proof
  boundary.
- **L2 mapped:** the manifest identifies NodeMem as the current owner of
  `nodemem.memory` and as a consumer of the canonical NodeAgent event concept and
  ProofLoop certification.

NodeMem does **not** run a product agent, so it intentionally has no
`nodeagent.yaml`. Its `ScanInput` and `MemoryStore` are domain contracts used by a
host runtime. A future NodeAgent adapter may translate `nodeagent.event/v1` into
`ScanInput`, but this repository does not define a competing runtime event
envelope.

## Contract boundaries

| Concern | Current truth |
| --- | --- |
| Passive memory classification, policy, deduplication, and storage port | Owned by NodeMem |
| Runtime event envelope | Consumed from `nodeagent.event/v1`; a canonical adapter is not implemented here yet |
| Convex support | Schema definitions and schema-only smoke test; not a deployed backend proof |
| Certification receipt | ProofLoop owns `proofloop.receipt/v1` |
| NodeMem smoke JSON | Local evidence only; it is not yet a `proofloop.receipt/v1` implementation |

For that reason, `nodekit.yaml` declares `proof.receiptSchema: null`. The
`npm run proof` gate emits and verifies the existing local smoke evidence without
claiming canonical receipt compatibility.

## Commands

```bash
npm run demo
npm run doctor
npm run check
npm run proof
```

From a sibling NodeKit checkout, validate the repository contract with:

```bash
node ../node-platform/src/cli.mjs repo check --repo-root .
```
