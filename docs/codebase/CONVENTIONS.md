# Conventions

Short, because most of them are visible in any file you open.

## Code

- **ES modules with `.js` extensions in the import specifier**, even from
  TypeScript: `import { … } from "./ports.js"`. `moduleResolution` is `bundler`
  and there is no build step, so this is what resolves at run time.
- **Named exports only.** `src/index.ts` is the single barrel; if a symbol is not
  listed there, it is internal, and un-exporting it is a normal thing to do.
- **`camelCase` for functions, `PascalCase` for types and classes,
  `SCREAMING_SNAKE` for module constants.**
- **Domain nouns, not framework nouns.** `room`, `activity row`, `finding`,
  `suggestion`, `dismissal`, `watchlist`. If a name would only make sense to
  someone who read the code, it is the wrong name.
- **No `default` exports** except `convexSchema.ts`, where Convex requires one.
- **Async only where there is I/O.** The classifier, the policy comparison, the
  debouncer and the dedupe key are synchronous and pure. Anything that touches a
  store returns a promise.

## Comments

Every file opens with a comment naming **the person it is for and the failure it
prevents**, in ordinary language, before any technical term. That is the house
style — see `src/core/ports.ts` or `src/core/scanOrchestrator.ts`. A comment that
restates the code ("increments the counter") is worse than none.

Inline comments mark the non-obvious: why a gate sits where it does, why the boot
guard cannot live inside the module it guards.

## Behavior

- **Rows are patched, never deleted.** `patchRow` is the only write in the
  pipeline, and every suppression writes a `reason` so the decision is auditable.
- **Every limit is per room.** Quotas, policies and dismissals are scoped to one
  room; nothing here is global.
- **Quieter wins.** When the system default and the room policy disagree, the
  more restrictive one applies (`resolveAssistivePolicy`).
- **Comparisons on entity names are `toLowerCase().trim()`**, everywhere.

## Tests

- One behavior per `it`, and the title says the behavior in plain language
  ("suppresses an entity a human already dismissed"), not the function name.
- Setup goes through `tests/room.ts` (`scanMessage`) so each test shows only the
  thing it is about.
- A test that exists to stop a specific past defect says so in a comment with the
  defect — see `tests/demoMirror.test.ts` and `tests/packageContract.test.ts`.

## Evidence

Screenshots and clips live in `assets/` and `promotion/evidence/`, and **every one
has a producer script that can regenerate it** (`scripts/capture-graph-rail.mjs`,
`scripts/record-graph-rail.mjs`). An image with no producer is treated as
unverified — the repo's own promotion log records that rule being applied.
