# PR Review Guide: Automated Test Suite PoC

## Summary

This PR adds a multi-layered test suite PoC for the wallet creation workflow:
- **83 Jest tests** (Layers 1-3: unit, integration, component)
- **1 Maestro E2E flow** (Layer 4: full wallet creation on iOS simulator, 30+ steps across 5 screens)

## Production Code Changes

Each change to `src/` has a specific reason tied to React Native 0.77 + New Architecture (Fabric) compatibility with E2E automation tools.

### 1. `src/components/ToggleSwitch.js` (NEW)

**Why:** React Native's native `<Switch>` component doesn't fire `onValueChange` when tapped by XCUITest-based tools (both Detox and Maestro) under Fabric. This is a confirmed platform bug — the native UISwitch receives the tap but Fabric's event pipeline doesn't dispatch the value change to JS. The custom component uses `Pressable` instead, which works correctly. Props are API-compatible with the native Switch.

### 2. `src/components/NewHathorButton.js` (MODIFIED)

Three changes:

- **`TouchableOpacity` → `Pressable`:** TouchableOpacity doesn't respond to XCUITest taps in Fabric. Pressable does. Same class of issue as the Switch component.
- **Added `testID={props.testID}`:** Enables E2E tools to target specific buttons by stable ID instead of fragile text matching.
- **`disabled` prop → `onPress` guard:** Pressable's native `disabled` prop prevents XCUITest from ever registering taps on the element, even after it becomes enabled via a React state change. Using `onPress={props.disabled ? undefined : props.onPress}` keeps the element always tappable at the native level while guarding the callback in JS.

### 3. `src/screens/InitWallet.js` (MODIFIED)

- **`<Switch>` → `<ToggleSwitch>`:** See ToggleSwitch explanation above.
- **Buttons moved OUTSIDE `buttonView` container:** The `buttonView` style has `flex: 1, justifyContent: 'flex-end'` — creating a large empty flex area above the button. XCUITest taps on elements inside this container are silently intercepted by the empty flex space. Moving buttons out as siblings after an empty `<View style={buttonView} />` spacer fixes this while preserving the same visual layout (the spacer pushes buttons to the bottom).
- **`testID` props added** to the Start button and a seed-words data Text element.
- **`accessible={false}` on text-only container Views:** Prevents iOS from aggregating children's text into a single accessibility element that intercepts taps meant for interactive children.
- **`<Text testID="seed-words-data">`:** Maestro needs to read the 24 seed words to validate them on the BackupWords screen. This small visible text element makes them available via Maestro's `copyTextFrom` command.

### 4. `src/screens/BackupWords.js` (MODIFIED)

- **`testID="backup-step-number"` + `accessibilityLabel`:** Maestro reads the word position number from this element to look up the correct word during the 5-step validation.
- **`accessible={false}` on a container View:** Same accessibility aggregation fix as InitWallet.

### 5. `src/components/NumPad.js` (MODIFIED)

- **Added `testID={numpad-${number}}`:** The text "2" matches ambiguously on the PIN screen (the digit, subtitle "ABC", etc.). testIDs provide unambiguous targeting for E2E tools.

### 6. `src/sagas/nanoContract.js` (MODIFIED)

- **`clearLoadingLocksForTesting()` export:** The saga uses a module-level `loadingLockByNcId` Map for deduplication. Pre-existing tests failed because locks leaked between test runs. This function clears them for test isolation. Only called from test files.

## Test Files Added/Modified

| File | Tests | Purpose |
|------|-------|---------|
| `__tests__/utils.test.ts` | 24 | Financial math: `getIntegerAmount`, `getAmountParsed`, `getShortHash`, etc. |
| `__tests__/reducers/reducer.wallet.test.ts` | 14 | Wallet lifecycle: NOT_STARTED→LOADING→READY/FAILED, token ops, reset |
| `__tests__/sagas/wallet.test.ts` | 3 | Start wallet saga (failure path), reset wallet saga (happy + null wallet) |
| `__tests__/screens/InitWallet.test.tsx` | 9 | WelcomeScreen, InitialScreen, NewWordsScreen component rendering + interactions |
| `__tests__/screens/BackupWords.test.tsx` | 7 | 5-step word validation with deterministic shuffle |
| `__tests__/helpers/mockStore.ts` | — | Redux store factory for tests |
| `__tests__/helpers/mockNavigation.ts` | — | Navigation mock utilities |
| `__tests__/helpers/renderWithProviders.tsx` | — | Component test wrapper with Redux + Navigation |
| `__tests__/sagas/nanoContracts/*.test.js` | (fixed) | Updated to match current saga flow (pre-existing failures) |
| `__tests__/App.test.tsx` | (fixed) | Fixed redux mock (`legacy_createStore`) |

## E2E Flow

`.maestro/flows/walletCreation.yaml` navigates the complete wallet creation:

1. **WelcomeScreen** — toggle terms switch → tap Start
2. **InitialScreen** — tap New Wallet
3. **NewWordsScreen** — capture 24 seed words → tap Next
4. **BackupWords** — correctly select all 5 validation words (JS reads position number, looks up word, taps it)
5. **Success modal** — dismiss via backdrop tap
6. **ChoosePinScreen** — enter PIN 123456, confirm PIN, tap Start the Wallet
7. **Verify** — PIN screen dismissed (wallet initialization triggered)

Supporting scripts: `.maestro/scripts/captureWords.js`, `.maestro/scripts/lookupWord.js`

## Dependencies Added (devDependencies only)

- `@testing-library/react-native@13.3.3` — behavior-driven component testing
- `@testing-library/jest-native@5.x` — custom Jest matchers (`toBeVisible`, `toBeDisabled`)
- `redux-saga-test-plan@4.0.6` — saga testing with `expectSaga`

## Documentation

- `docs/e2e-framework-decision.md` — why Maestro over Detox and Appium (with hands-on test results from both)
- `docs/detox-setup-log.md` — troubleshooting log from the Detox evaluation
- `docs/maestro-implementation-plan.md` — Maestro setup and flow design
- `docs/testing-ci-plan.md` — CI integration plan (Phase 1: Jest, Phase 2: E2E, Phase 3: coverage thresholds)

## How to Run

```bash
# Jest (Layers 1-3)
npm test

# Maestro E2E (Layer 4) — requires iOS simulator + Metro running
maestro test .maestro/flows/walletCreation.yaml
```

## Framework Decision

Detox was evaluated first but abandoned due to:
1. UISwitch interaction broken in Fabric (onValueChange never fires)
2. Synchronization deadlock with recurring JS timers (Unleash polling)
3. DetoxSync swizzle failures with Fabric + Reanimated

Maestro was selected because it operates at the accessibility layer (architecture-agnostic), requires zero app instrumentation, and has active support including usage by Meta for RN framework testing. See `docs/e2e-framework-decision.md` for the full evaluation.
