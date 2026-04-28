# Testing Guide — hathor-wallet-mobile

## Purpose & audience

This guide is for **every contributor** (humans and agents) opening a PR
against this repository. Each new feature or bug fix should land with tests
that match the *intent* described below.

The goal is not "100% coverage". The goal is a **future-proof test suite**:
one that catches real regressions, survives refactors (such as the upcoming
Redux Toolkit slices migration), and gives reviewers enough signal that
green CI is meaningful.

If you are unsure whether your change needs a test, the answer is almost
always *yes* — but the right *kind* of test depends on the layer you're
changing. The next section maps that out.

---

## The four-layer test pyramid

Tests in this repo are organized by *layer*, not by feature. Pick the layer
that matches what you're changing:

### 1. Unit — pure functions, reducers, utilities

Fast, deterministic, no I/O, no mocks. Run on every PR.

- **What lives here**: `src/utils*`, `src/helpers*`, `src/constants*`,
  reducer handlers in `src/reducers/`.
- **Test location**: `__tests__/` (top level) and `__tests__/reducers/`.
- **Examples**:
  - `__tests__/utils.test.ts` — utility functions.
  - `__tests__/reducers/reducer.wallet.test.ts` — wallet/token/reset reducer behavior.
  - `__tests__/reducers/reducer.reown.test.ts` — Reown pending-requests reducer.

### 2. Saga integration — `redux-saga-test-plan`

Drives a saga end-to-end against the real reducer (or a near-real test
store), with mocks only at the I/O boundary (`@hathor/wallet-lib`, fetch,
async storage).

- **What lives here**: the orchestration logic in `src/sagas/`.
- **Test location**: `__tests__/sagas/`.
- **Examples**:
  - `__tests__/sagas/wallet.test.ts` — wallet start/reload sagas.
  - `__tests__/sagas/reown.test.js` — Reown session and pending-request flows.
  - `__tests__/sagas/nanoContracts/registerNanoContract.test.js` — nano-contract registration saga.

### 3. Component / screen — React Native Testing Library

Mounts a screen with a mock store and mock navigation, then asserts on what
the user sees and can interact with.

- **What lives here**: `src/screens/` and non-trivial `src/components/`.
- **Test location**: `__tests__/screens/`.
- **Helpers** (reuse these — do not reinvent setup boilerplate):
  - `__tests__/helpers/renderWithProviders.tsx` — mounts with Redux + theme.
  - `__tests__/helpers/mockStore.ts` — preconfigured store factory.
  - `__tests__/helpers/mockNavigation.ts` — fake navigation prop.
- **Examples**:
  - `__tests__/screens/InitWallet.test.tsx`.
  - `__tests__/screens/BackupWords.test.tsx`.

### 4. End-to-end — *not yet present*

Detox/Maestro-style tests that exercise the real native build are out of
scope today. PRs should not block on E2E coverage. When this layer
materializes, it will live in `e2e/`.

---

## What every PR must include

A short, opinionated checklist. If your PR touches code in any of these
buckets, the corresponding test is **expected**, not optional.

| Code change | Required test |
|---|---|
| New exported function in `src/utils*` / `src/helpers*` | Unit test in `__tests__/`. |
| New reducer case **or** new initial-state key | (a) Behavior test (action → state) AND (b) entry in the slice's action-type / state-shape contract block. |
| New action type in `src/actions.js` | Action-type contract assertion in the corresponding reducer test file. |
| New saga | `redux-saga-test-plan` test covering the happy path and at least one failure path. |
| New screen or non-trivial component | Mount test using `renderWithProviders`, with assertions on visible behavior (not snapshot blobs). |
| Bug fix | A test that **fails on `master`** and **passes with your fix**. The PR description should reference this test. |

---

## Test-design principles

These are the *intent* behind the suite. Follow them — they're what makes
the safety net actually catch things.

### Test the public contract, not the implementation

Import the **root** reducer and dispatch real action creators. Do not
import internal `onXxx` handlers from `reducer.js` — those are
implementation details that a refactor (e.g. RTK slices) will rename or
remove. Tests written against the public contract survive refactors
unchanged.

```ts
// ✅ Good — survives any internal reorg
import { reducer } from '../../src/reducers/reducer';
import { setWallet } from '../../src/actions';
const next = reducer(state, setWallet(myWallet));

// ❌ Bad — breaks the moment onSetWallet is renamed/inlined into a slice
import { onSetWallet } from '../../src/reducers/reducer';
const next = onSetWallet(state, { payload: myWallet });
```

### Pin contracts at the seams

The cheap tests that catch the most real regressions are **shape and
identifier snapshots**:

- **Initial-state shape**: the keys at each level of `getInitialState()`
  for the sub-tree you're touching.
- **Action-type strings**: the literal `.type` of every action creator
  your code dispatches or listens for.

Behavior tests miss both of these — they happily pass if state moves from
`state.foo` to `state.bar.foo` and the test was written against the new
shape. Shape and type snapshots force the diff into the open during code
review. See the "Slice/refactor safety net" pattern below.

### Prefer behavior assertions over snapshot blobs

`expect(state).toBe(WALLET_STATUS.READY)` is reviewable. A 200-line
`toMatchSnapshot()` blob is not — reviewers will rubber-stamp it and miss
real changes. Use Jest snapshots only for narrow, structurally-meaningful
output (e.g. a single rendered subtree).

### One test, one fact

If a test asserts five unrelated things, split it. The failure message
should point at the bug, not require detective work to figure out which
of five `expect` calls broke.

### Reuse the helpers

`getInitialState()`, `renderWithProviders()`, `mockStore()`,
`mockNavigation()` already exist. Add to them rather than copying setup
boilerplate. If you find yourself writing the same five-line setup twice,
move it into `__tests__/helpers/`.

### Don't mock what you can run

- Pure reducers and utilities **never** need mocks.
- Sagas only need mocks at the **I/O boundary** (`@hathor/wallet-lib`,
  fetch, async storage). The reducer in a saga test should be the real one.
- Mock-heavy tests are a smell — they tend to assert *your mocks* rather
  than *your code*. If a test is half mock setup, the design is probably
  wrong; consider extracting the I/O behind an interface and testing the
  pure logic directly.

### Don't leak persistence between tests

Jest workers share process state across files. If a test mutates
`AsyncStorage`, a global, or a module-level cache, reset it in
`afterEach`. Symptom of a leak: test passes when run alone but fails in
the full suite (or vice versa).

### Use real action creators, not raw `{ type: ... }` objects

Where an action creator exists, use it. This keeps the test exercising
the same code path your production code uses, and any creator-shape change
(adding payload validation, switching to RTK `prepare`) is caught in one
place. The exception is action types with no exported creator (some sagas
dispatch raw types) — there, dispatch `{ type: types.X }` and add an
explicit type-string assertion.

---

## Future-proofing patterns

Concrete patterns used in this repo. Reach for them when the situation
fits.

### Slice / refactor safety net

When a section of code is on a known refactor path (e.g. the RTK-slices
migration of `src/reducers/reducer.js`), pair every behavior test with
**shape and action-type snapshots** for the surface it touches. The three
layers are:

1. **Behavior**: action in → state out.
2. **State-shape contract**: a sorted list of keys at each level of the
   sub-tree, asserted via `expect(Object.keys(...).sort()).toEqual([...])`.
3. **Action-type contract**: literal `.type` strings of every action
   creator that touches the sub-tree.

Canonical examples in this repo:

- `__tests__/reducers/reducer.wallet.test.ts` — wallet / tokens / reset.
- `__tests__/reducers/reducer.reown.test.ts` — Reown pending requests.

This pattern means a refactor PR's diff includes **explicit, reviewable**
updates to the shape/type snapshots — the reviewer can verify each change
is intentional rather than scanning thousands of lines for accidental drift.

### State-shape contract for new top-level keys

When you add a new top-level state key (or a new sub-tree like `reown.x`),
add it to the corresponding shape-contract block in the **same PR**. This
keeps the contract honest — it never lags behind the code.

### Action-type contract for new actions

Same rule for action types: the moment you add a new entry to `types` in
`src/actions.js`, add a one-line assertion to the action-type contract
block:

```ts
expect(myNewAction(somePayload).type).toBe('MY_NEW_ACTION');
```

If there's no exported creator, assert the type constant directly:

```ts
expect(types.MY_NEW_ACTION).toBe('MY_NEW_ACTION');
```

---

## Running tests locally

```sh
npm test                       # full suite
npx jest <pattern>             # single file or directory while iterating
npx jest --coverage            # coverage report (slower)
npx jest --watch <pattern>     # iterative TDD loop
```

---

## Appendix: CI follow-ups

Items below are infrastructure work, not test-design work. They were the
original content of this document (when it was named `testing-ci-plan.md`),
preserved here so that work isn't lost.

### Wire the suite into GitHub Actions

Add a test step to `.github/workflows/main.yml` after the linter step:

```yaml
    - name: Run tests
      run: npm test -- --ci --coverage --maxWorkers=2
    - name: Upload coverage
      uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: coverage/
```

This runs on the existing `ubuntu-latest` runner with no extra
infrastructure.

### Coverage thresholds (after baseline established)

Once the suite is wired into CI and coverage settles, add to the Jest
config in `package.json`:

```json
"coverageThreshold": {
  "global": {
    "branches": 30,
    "functions": 30,
    "lines": 40,
    "statements": 40
  }
}
```

Increase incrementally as coverage grows.

### Known historical issues (resolved in commit `8f9eeb2`)

These four pre-existing test issues were noted when the test-suite PoC
landed. All have since been fixed and are listed here for historical
reference only:

- ✅ `__tests__/sagas/nanoContracts/fixtures.js` was being picked up as a
  test file but contained no tests.
- ✅ `__tests__/sagas/nanoContracts/registerNanoContract.test.js` failed
  due to missing `blueprintInfo.name` in the saga mock.
- ✅ `__tests__/sagas/nanoContracts/historyNanoContract.test.js` failed
  with "More than one instance of bitcore-lib found".
- ✅ `__tests__/App.test.tsx` failed due to a missing
  `react-native-url-polyfill` transform.
