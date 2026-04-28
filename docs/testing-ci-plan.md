# Testing CI Integration Plan

This document describes how to integrate the automated test suite into CI/CD.
It is intended for a future agent or developer to pick up and execute.

## Phase 1: Unit + Integration Tests in CI (immediate)

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

This runs on the existing `ubuntu-latest` runner with zero additional infrastructure.

### Prerequisite: Fix pre-existing test issues

Before enabling tests in CI, address these known issues:

1. **`__tests__/sagas/nanoContracts/fixtures.js`** — Jest picks this up as a test file
   but it contains no tests. Either rename it to `fixtures.ts` (no `.test.`) or add it
   to `testPathIgnorePatterns` in the Jest config.

2. **`__tests__/sagas/nanoContracts/registerNanoContract.test.js`** — 2 of 5 tests fail
   due to an API change in the `nanoContract` saga. The test mock doesn't provide
   `blueprintInfo.name` (line 207 of `src/sagas/nanoContract.js`). Fix the mock data.

3. **`__tests__/sagas/nanoContracts/historyNanoContract.test.js`** — Fails with
   "More than one instance of bitcore-lib found" due to importing from
   `@hathor/wallet-lib/lib/nano_contracts/utils`. Consider mocking that import.

4. **`__tests__/App.test.tsx`** — Fails due to missing `react-native-url-polyfill`
   transform. The polyfill is in `transformIgnorePatterns` now but the test may
   need additional mocks.

## Phase 2: Coverage Thresholds

After reaching baseline coverage, add to the Jest config in `package.json`:

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

Increase thresholds incrementally as coverage grows.

## Current Test Inventory (as of PoC)

| File | Tests | Layer |
|------|-------|-------|
| `__tests__/utils.test.ts` | 24 | Unit |
| `__tests__/reducers/reducer.wallet.test.ts` | 14 | Unit |
| `__tests__/sagas/wallet.test.ts` | 3 | Integration |
| `__tests__/screens/InitWallet.test.tsx` | 9 | Component |
| `__tests__/screens/BackupWords.test.tsx` | 7 | Component |
| **Total** | **57** | |
