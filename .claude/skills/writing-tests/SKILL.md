---
name: writing-tests-hathor-wallet-mobile
description: Use when adding or modifying any test file in this repo (paths under __tests__/, files matching *.test.ts / *.test.tsx / *.test.js). Encodes the conventions surfaced by repeated code reviews so each new test PR doesn't re-fight the same nits — jest-globals import, three-layer reducer safety net, helper reuse, lock-regen Node version, mock annotation pattern, and the anti-patterns list.
---

# Writing tests in hathor-wallet-mobile

The full reference is `docs/testing-guide.md` (in this repo). This skill
distills the rules that have been raised in review and must be followed
on every PR.

## 1. Always import jest globals

The repo's `.eslintrc` has no `env.jest` and no test-file override.
Without explicit imports, `describe`/`it`/`expect`/`jest`/`beforeEach`
trip `no-undef` and CI's `npm run lint` fails.

```ts
import { describe, it, expect } from '@jest/globals';
// add jest, beforeEach, etc. as needed
```

## 2. Test the public contract, not implementation

Dispatch real action creators against the **root** `reducer`. Do **not**
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

Every reducer test should pin three layers so a future refactor surfaces
drift in explicit, reviewable diffs:

1. **Behavior** — action in → state out.
2. **State-shape contract** — sorted list of keys at each level of
   `getInitialState()` for the sub-tree you touch:
   ```ts
   expect(Object.keys(state.x).sort()).toEqual([...]);
   ```
   Use **sorted-keys equality** (not `toHaveProperty`) so a key that's
   moved under a sub-tree fails the test. Pin keying conventions too
   (e.g. `state.tokens` is `{ [uid]: token }` — assert one sample uid).
3. **Action-type contract** — literal `.type` strings for every in-scope
   action creator: `expect(myAction(x).type).toBe('MY_ACTION')`.
   Use **minimal valid payloads**, not `{}` / `null`. A future RTK
   `prepare` callback validating inputs would throw before reaching
   `.type`, masking the assertion behind a creator-level error.

Canonical examples: `__tests__/reducers/reducer.wallet.test.ts`,
`__tests__/reducers/reducer.reown.test.ts`.

## 4. Reuse `__tests__/helpers/`, don't redefine

Available helpers:

- `getInitialState.js` — root-reducer initial state. Always import.
- `renderWithProviders.tsx` — mount React Native components with Redux + theme.
- `mockStore.ts` — preconfigured store factory.
- `mockNavigation.ts` — `createMockNavigation()` / `createMockRoute()`
  factories. This file does **not** call `jest.mock(...)` itself; do
  that at the top of your test file (Babel only hoists `jest.mock` at
  module scope).

**New helpers**: prefer `.js`, not `.ts`. The repo has no TS-aware
import resolver — `.ts` helpers fail `import/no-unresolved` from any
consumer. Use `.ts` only if you're prepared to add the resolver config.

## 5. Saga tests use `redux-saga-test-plan`

Drive the saga end-to-end against the real reducer. Mock only at the
I/O boundary (`@hathor/wallet-lib`, fetch, async storage). Reducer in a
saga test must be the real one — mocking it asserts your mocks, not
your code.

For function-identity comparisons inside `.provide([...])`, import the
real saga function (`isWalletServiceEnabled`, etc.). These will *not*
appear in `no-unused-vars` lint output but are required at runtime.
Verify with `grep` before deleting an "unused" saga import.

## 6. Component / screen tests use `renderWithProviders`

Mount with the helper, find by visible text or `testID`, assert on
behavior the user cares about. Avoid `toMatchSnapshot()` blobs —
explicit `expect(...).toBe(...)` per invariant is reviewable.

## 7. Mocks that don't match production imports → annotate inline

`jestMockSetup.js` pattern: if a `jest.mock(...)` factory exposes the
wrong shape (named-only when production imports default + named, etc.)
and **no current test exercises that code path**, add a comment block
listing the named exports a future test would need. Don't preemptively
restructure the mock — that's scope creep, and reviewers raise the
mismatch when they see it without the context.

Examples already in the file:
- `@react-native-firebase/messaging`
- `@hathor/unleash-client`

## 8. Anti-patterns to avoid

- **Silent `return` to skip a test** when fixtures might collide.
  Replace with an explicit guard (`expect(x).not.toEqual(y)`) so a
  failing fixture is never silently masked.
- **Duplicate near-clone tests.** Two tests that render the same
  component, do the same interaction, and assert the same text are
  redundant — keep one with a unique, accurate name.
- **Unused destructures from `render(...)`**. Drop `queryByText` if
  you don't call it.
- **Unused imports.** Run `npx eslint <test-file>` before committing
  and clean up `no-unused-vars` warnings — but verify with grep first;
  saga tests sometimes use imports as function-identity references
  that lint can miss.
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
generated on Node 24 / npm 11 will fail CI's `npm ci` with errors
like *"Missing: typescript@6.0.3 from lock file"*.

## 10. Verify before claiming done

Before opening / updating the PR:

```sh
nvm use 22
npx jest --no-coverage    # full suite green
npx eslint <files-you-touched>    # 0 errors
npm ci --dry-run    # lock and package.json in sync
```

If you touch a contract block (state shape or action types), do a
quick **mutation drill**: temporarily break the production code and
confirm your test fails, then revert. This catches "tested but
doesn't actually assert" mistakes.
