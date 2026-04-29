---
name: writing-tests-hathor-wallet-mobile
description: Use when adding or modifying any test file (paths under __tests__/, or files matching *.test.{ts,tsx,js}). Encodes repo-specific test conventions surfaced through review — jest globals, RTK-migration safety net, helper reuse, mock annotations, and the gotchas an agent won't infer from grepping nearby tests.
---

# Writing tests in hathor-wallet-mobile

> **If a rule here conflicts with `docs/testing-guide.md`, this file
> wins** — it's the authoritative source for test conventions.
> `docs/testing-guide.md` is the long-form "why" reference and the
> per-PR policy table.

A frontier model can read the existing tests and infer most idioms.
This skill covers what it *can't* infer: historical decisions, hidden
foot-guns, and patterns that look fine but silently misbehave.

## Repo-specific gotchas (read these first)

These are concrete invariants you'd otherwise discover by breaking CI.

1. **Don't bump `jest-circus` past 29.7.0.** It's pinned to match
   `jest@29.7.0` (`package.json:120-121`). `jest-circus@30+` requires
   `jest@30+` (breaking config changes); a routine dep bump silently
   breaks `jest.config` parsing. Land both upgrades together in a
   separate PR. See commit `49a4e57`.

2. **`@hathor/wallet-lib` sub-paths are already mocked.**
   `jestMockSetup.js:155-162` mocks
   `@hathor/wallet-lib/lib/nano_contracts/utils` and
   `@hathor/wallet-lib/lib/api/axiosWrapper` to dodge the
   *"more than one instance of bitcore-lib found"* error. If your test
   imports another wallet-lib sub-path and behaves oddly, check this
   file before adding a new `jest.mock`.

3. **`legacy_createStore` is intentional, not legacy debt.**
   `__tests__/helpers/mockStore.ts:7` uses
   `legacy_createStore as createStore` because RTK
   (`@reduxjs/toolkit`) is not in deps yet — that migration is the
   *reason* this test suite exists. Don't add RTK to satisfy a lint
   suggestion.

4. **Do NOT pattern-match from `__tests__/sagas/networkSettings.test.ts`.**
   It has three `describe.skip(...)` blocks (lines 17, 246, 303) and
   uses bare `describe`/`it`/`jest` without importing from
   `@jest/globals`. It compiles only because `no-undef` warnings (not
   errors) are tolerated by `.eslintrc:52`. New tests must import jest
   globals (see below) and skipped describe blocks are tech debt, not
   convention. Use `reducer.{wallet,reown}.test.ts` or
   `__tests__/sagas/wallet.test.ts` as canonical references.

5. **`testPathIgnorePatterns` carve-outs** (`package.json:161-165`):
   `__tests__/helpers/` and `__tests__/sagas/nanoContracts/fixtures.js`
   are skipped. New helpers go under `__tests__/helpers/` (auto-skipped).
   Fixture files **must not** end in `.test.{ts,tsx,js}` — jest will
   collect them as suites and fail with *"no tests in file"*.

6. **For sagas using `delay(ms)`, use redux-saga-test-plan's
   `.run({ silenceTimeout: true })`.** Example:
   `__tests__/sagas/wallet.test.ts:181`. The repo has no
   `jest.useFakeTimers()` discipline; mocking `delay` directly is the
   wrong instinct.

7. **`provide({ call(effect, next) { ... } })` matchers that compare
   `effect.fn?.name === 'bound start'` are fragile.** That's matching
   against `Function.prototype.bind`'s naming convention. If the
   production code refactors `wallet.start.bind(wallet)` into anything
   else, the matcher silently falls through to `next()` and the saga
   runs the real implementation. Prefer reference equality
   (`effect.fn === mockWalletInstance.start`) when possible. See
   `wallet.test.ts:147-164` — that pattern is a known smell, not the
   ideal.

## 1. Always import jest globals

`.eslintrc` has no `env.jest` and no test-file override. Without
explicit imports, `describe`/`it`/`expect`/`jest`/`beforeEach` trip
`no-undef` and CI's `npm run lint` fails.

```ts
import { describe, it, expect } from '@jest/globals';
// add jest, beforeEach, etc. as needed
```

## 2. Test the public contract, not implementation

Dispatch real action creators against the **root** `reducer`. Do not
import internal `onXxx` handlers — they'll be renamed or inlined when
the reducer migrates to RTK slices.

```ts
// ✅ Good — survives any internal reorg
import { reducer } from '../../src/reducers/reducer';
import { resetWalletSuccess } from '../../src/actions';
const next = reducer(state, resetWalletSuccess());

// ❌ Bad — breaks when onResetWalletSuccess is inlined into a slice
import { onResetWalletSuccess } from '../../src/reducers/reducer';
```

## 3. Reducer tests pin three contracts

So a future RTK-slices refactor surfaces drift in explicit, reviewable
diffs:

- **Behavior**: action in → state out.
- **State-shape contract**: sorted-keys equality on each level of
  `getInitialState()` for the sub-tree you touch.
  `expect(Object.keys(state.x).sort()).toEqual([...])`. Use
  sorted-keys equality, **not** `toHaveProperty` — the latter passes
  when keys are *moved* under a sub-tree (`state.foo` →
  `state.foo.foo`), exactly the failure you want to catch. Pin keying
  conventions too (e.g. `state.tokens` is `{ [uid]: token }` — assert
  one sample uid is at the top level).
- **Action-type contract**: literal `.type` strings for every in-scope
  action creator: `expect(myAction(x).type).toBe('MY_ACTION')`.

> **Use minimal *valid* payloads in action-type assertions.** Not `{}`
> / `null` shortcuts. A future RTK `prepare` callback that validates
> inputs would throw before reaching `.type`, masking the test behind
> a creator-level error. `setTokens({}).type` is brittle;
> `setTokens({ [DEFAULT_TOKEN.uid]: DEFAULT_TOKEN }).type` survives.

Canonical examples: `__tests__/reducers/reducer.{wallet,reown}.test.ts`.

## 4. Helper reuse — the two non-obvious rules

Helpers live in `__tests__/helpers/`. Reuse them; don't redefine.

1. **`mockNavigation.ts` returns plain objects, never calls
   `jest.mock`.** Babel only hoists `jest.mock(...)` written at module
   scope of the test file. Wrapping it inside an exported helper makes
   it a runtime no-op — the mock fires *after* modules under test are
   already imported.
2. **New helpers must be `.js`, not `.ts`.** ESLint's default
   resolver (no `eslint-import-resolver-typescript` configured) can't
   follow `.ts`/`.tsx` extensions, so `.ts` helpers fail
   `import/no-unresolved` from any consumer. **`getInitialState.js`
   is the JS reference example — copy its shape for new helpers.**
   The branch currently ships three TS helpers as tracked exceptions:
   `mockNavigation.ts`, `mockStore.ts`, `renderWithProviders.tsx`.
   They predate this rule and are scheduled to flip to `.js` (or
   stay TS once the typescript resolver is added). Don't pattern-match
   from them when authoring new helpers, and don't add new TS helpers
   in the meantime.

## 5. Saga tests

Drive sagas end-to-end with `redux-saga-test-plan`. Mock only at the
I/O boundary (`@hathor/wallet-lib`, fetch, async storage). The reducer
in a saga test must be the real one — mocking it asserts your mocks,
not your code.

**`no-unused-vars` is unreliable for saga imports.** Sagas pass
function references through `.provide([...])` matchers
(`if (effect.fn === isWalletServiceEnabled) ...`). Lint sees these as
"used". But the *opposite* also happens: lint may miss an import that
*is* used as a function-identity reference. Before deleting an
"unused" saga import, grep for it across the file.

## 6. Component / screen tests

Mount with `renderWithProviders`. **No `toMatchSnapshot()` blobs** —
explicit `expect(...).toBe(...)` per invariant is reviewable; a
200-line snapshot blob is rubber-stamped.

## 7. Mocks that don't match production imports → annotate inline

`jestMockSetup.js` pattern: if a `jest.mock(...)` factory exposes the
wrong shape (named-only when production imports default + named, etc.)
and **no current test exercises that code path**, add a comment block
listing the named exports a future test would need. Don't preemptively
restructure — that's scope creep, and reviewers re-raise the mismatch
when they see it without the context.

Examples already in the file: `@react-native-firebase/messaging`,
`@hathor/unleash-client`. Both are documented latent debt with
remediation recipes attached.

## 8. Anti-patterns flagged in past reviews

- **Silent `return` to skip a test** when fixtures might collide.
  Replace with an explicit guard (`expect(x).not.toEqual(y)`) so a
  failing fixture is never silently masked.
- **`toStrictEqual` with `Error` instances** is fine — Jest ≥ 24
  structurally compares `name` + `message`. Don't capture-and-reuse
  the original `Error` reference unless you need referential identity.

## 9. Lockfile regen for test deps must use Node 22

If your test work adds or upgrades a dev dep, regenerate
`package-lock.json` on the same Node version CI uses
(`.github/workflows/main.yml` matrix → 22.x):

```sh
nvm install 22 && nvm use 22
npm install --no-audit --no-fund
```

Different Node majors resolve transitive deps differently. A lock
generated on Node 24 / npm 11 fails CI's `npm ci` with errors like
*"Missing: typescript@6.0.3 from lock file"*.

## 10. Verify before claiming done — lead with the mutation drill

> **Mutation drill (cheap, catches "tested but doesn't assert"
> bugs):** before claiming a contract block is done, break the
> production code (flip a return value, rename a field) and confirm
> your test fails red. Then `git restore`. If the test stayed green,
> your assertion is degenerate.

Then:

```sh
nvm use 22
npx jest --no-coverage      # full suite green
npx eslint <files-touched>  # 0 errors
npm ci --dry-run            # lock and package.json in sync
```
