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

## Phase 2: E2E Tests in CI

Create a new workflow `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests
on:
  pull_request:
    branches: [master, release, release-candidate]

jobs:
  e2e-android:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20.x'
    - run: npm ci
    - uses: reactivecircus/android-emulator-runner@v2
      with:
        api-level: 34
        target: google_apis
        arch: x86_64
        script: |
          npx detox build --configuration android.emu.debug
          npx detox test --configuration android.emu.debug

  e2e-ios:
    runs-on: macos-latest
    timeout-minutes: 60
    # Run iOS E2E on nightly schedule or manually (macOS runners are 3-5x more expensive)
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20.x'
    - run: npm ci
    - run: cd ios && pod install
    - run: npx detox build --configuration ios.sim.debug
    - run: npx detox test --configuration ios.sim.debug
```

### E2E prerequisites

1. **Add `testID` props** to key interactive elements across screens for reliable
   element selection. Priority elements:
   - Agreement switch on WelcomeScreen
   - "New Wallet" / "Import Wallet" buttons on InitialScreen
   - Word buttons on BackupWords screen
   - PIN input on ChoosePinScreen
   - Main tab buttons on Dashboard

2. **E2E build configuration**: Consider a separate build scheme that sets
   `SKIP_SEED_CONFIRMATION=true` so E2E tests can skip the backup word validation
   (which requires reading words from screen and matching them).

3. **Wallet mock**: For E2E tests that need a loaded wallet (send/receive flows),
   create a fixture with pre-generated seed words that connect to a testnet.

## Phase 3: Coverage Thresholds

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
| `e2e/flows/walletCreation.test.ts` | 4 | E2E |
| **Total** | **61** | |
