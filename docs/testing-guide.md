# Testing Guide — hathor-wallet-mobile

## Audience

Every contributor (humans and AI agents) opening a PR. This is the
long-form reference and per-PR policy. The authoritative
*conventions* — what to do and not to do at the file level — live in
[`.claude/skills/writing-tests/SKILL.md`](../.claude/skills/writing-tests/SKILL.md).
That file auto-loads in Claude Code when you edit tests; non-Claude
agents should read it directly.

If a rule here conflicts with the SKILL, the SKILL wins (it's closer
to the code and gets updated more often).

## The four-layer test pyramid

| Layer | Lives in | Example |
|---|---|---|
| **Unit** — pure functions, reducers | `__tests__/`, `__tests__/reducers/` | `reducer.wallet.test.ts`, `reducer.reown.test.ts`, `utils.test.ts` |
| **Saga integration** — `redux-saga-test-plan` against the real reducer, I/O boundary mocked | `__tests__/sagas/` | `wallet.test.ts`, `reown.test.js` |
| **Component / screen** — `renderWithProviders` + RTL queries on visible behavior | `__tests__/screens/` | `InitWallet.test.tsx`, `BackupWords.test.tsx` |
| **End-to-end** | *(not yet present — out of scope, will live in `e2e/` when added)* | — |

## What every PR must include

| Code change | Required test |
|---|---|
| New exported function in `src/utils*` / `src/helpers*` | Unit test in `__tests__/`. |
| New reducer case **or** new initial-state key | (a) Behavior test (action → state) AND (b) entry in the slice's action-type / state-shape contract block. |
| New action type in `src/actions.js` | Action-type contract assertion in the corresponding reducer test file. |
| New saga | `redux-saga-test-plan` test covering the happy path and at least one failure path. |
| New screen or non-trivial component | Mount test using `renderWithProviders`, with assertions on visible behavior (not snapshot blobs). |
| Bug fix | A test that **fails on `master`** and **passes with your fix**. PR description should reference it. |

## Design principles

These are the load-bearing *why* statements. The mechanical *how* is
in the SKILL.

### Don't mock what you can run

- Pure reducers and utilities **never** need mocks.
- Sagas only need mocks at the **I/O boundary**
  (`@hathor/wallet-lib`, fetch, async storage). The reducer in a saga
  test must be the real one.
- Mock-heavy tests are a smell — they tend to assert *your mocks*
  rather than *your code*. If a test is half mock setup, the design
  is probably wrong; consider extracting the I/O behind an interface
  and testing the pure logic directly.

### Don't leak persistence between tests

Jest workers share process state across files in a worker. If a test
mutates `AsyncStorage`, a global, or a module-level cache, reset it in
`afterEach`. Symptom of a leak: test passes when run alone but fails
in the full suite (or vice versa).

### Use real action creators, not raw `{ type: ... }` objects

Where an action creator exists, use it. This keeps the test exercising
the same code path your production code uses, and any creator-shape
change (adding payload validation, switching to RTK `prepare`) is
caught in one place.

The exception is action types with no exported creator — for example
`START_WALLET_NOT_STARTED`, dispatched as a raw object inside
`src/sagas/wallet.js`. There, dispatch `{ type: types.X }` and add an
explicit type-string assertion. See
`__tests__/reducers/reducer.wallet.test.ts:182`.

### Slice / refactor safety net

When a section of code is on a known refactor path (e.g. the RTK-slices
migration of `src/reducers/reducer.js`), pair every behavior test with
**state-shape and action-type snapshots** for the surface it touches.
The full mechanical recipe is in the SKILL. Canonical examples:
`__tests__/reducers/reducer.wallet.test.ts`,
`__tests__/reducers/reducer.reown.test.ts`.

The point: a refactor PR's diff includes **explicit, reviewable**
updates to the shape/type snapshots — the reviewer can verify each
change is intentional rather than scanning thousands of lines for
accidental drift.

## When `null`-handling tests look vacuous

A test that runs a saga with `state.wallet = null` and asserts that
`mockWallet.stop` was not called *looks* tautological — if state.wallet
is null, the saga can't reach a stop call regardless. It isn't
tautological **as long as** `beforeEach` does `jest.clearAllMocks()`:
the assertion is then real coverage of the null-guard short-circuit.
Without `clearAllMocks`, a stale call count from a prior test can
silently break the test's premise. See
`__tests__/sagas/wallet.test.ts:96-104` for the pattern and the
inline rationale.
