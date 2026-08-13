# Testing

```bash
npm test          # 47 tests, 6 files, ~2s
npm run typecheck # tsc --noEmit
npm run proof     # the 13-check pipeline story + a JSON receipt
npm run capture   # 12 checks in a real browser (needs: npx playwright install chromium)
npm run check     # secret-scan + typecheck + tests + proof — run this before pushing
```

## What each file proves

| File | Tests | It fails when |
|---|---:|---|
| `tests/scanOrchestrator.test.ts` | 14 | A gate stops firing, its `reason` string changes, the policy comparison flips, the dedupe key stops separating authors, or the debounce window stops capping |
| `tests/classifier.test.ts` | 11 | A signal regex, a score threshold, the stop-name filter or the pinned `CLASSIFIER_VERSION` changes |
| `tests/demoMirror.test.ts` | 10 | The plain-JS copy of the classifier in `demo/nodeMemDemoCore.mjs` disagrees with `src/core/classifier.ts` on any of ten texts |
| `tests/packageContract.test.ts` | 6 | The README tells readers to import something the barrel does not export, a script invokes a binary no declared dependency provides, or `bin` points at a missing file |
| `tests/inMemoryAdapter.test.ts` | 5 | The reference store stops satisfying the port |
| `tests/convexSchema.test.ts` | 1 | The Convex schema module stops loading at run time |

## Three of these exist because of a specific defect

Not general hygiene — each one failed on the tree before it was fixed, and each
was confirmed to fail again when the fix is reverted:

- **`demoMirror`** — the two classifiers had already drifted. On "The Next Series
  will be announced" the library correctly found no entity; the demo copy
  invented a company called "The Next Series" and scored it 0.54 instead of 0.36.
- **`packageContract` / barrel** — the README's `import { computeDebounce } from
  "nodemem"` did not resolve; the symbol was never exported.
- **`packageContract` / binaries** — `npm run dev` ran `vite`, which nothing in
  `package.json` installs. Reinstate that script and the test fails with
  `` `vite` is in a script but no declared dependency provides it ``.

## Writing a test here

Use `scanMessage` from `tests/room.ts`: it inserts an activity row and scans it,
the way a host would, so the test body is the assertion and nothing else.

```ts
const result = await scanMessage(store, "CardioNova just raised Series A funding");
expect(result.reason).toBe("duplicate_entity");
```

Titles state the behavior in plain language. A test that only re-states an
implementation detail is a maintenance cost with no failure mode.

## The browser gate is not optional

`npm run capture` is the only check that looks at what a user sees. It asserts,
in a real Chromium:

1. entities were noticed, every one of them uncounted;
2. **zero edges exist before any human confirmation** — the honesty assertion;
3. exactly one `traversal` edge after one Confirm click;
4. with `esm.sh` blocked: a visible `role="alert"` panel that names the cause,
   offers a recovery path, reads as failed to a human, hides the caption, and a
   Retry that actually recovers.

It writes `assets/graph-rail/{before,after}-confirm.png` and
`promotion/evidence/cdn-blocked-*.png`. Restart it from a clean tree — a
screenshot taken from a stale process is evidence about code that no longer
exists.

## Not covered

- Concurrency. Two scans racing on the same room can both pass the quota gate;
  no test drives that, and no store method is transactional.
- Load. Nothing measures throughput or memory over a long run.
- Mobile layout. `demo/graph-rail/index.html` has no media query and overflows
  below 768px wide; the defect is open in `promotion/PROMOTION_LOG.md` (D1) and
  no test asserts a viewport.
