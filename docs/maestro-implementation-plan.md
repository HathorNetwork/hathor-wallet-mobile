# Maestro E2E Implementation Plan

## Current State (as of commit 9432c16 on feat/automated-test-suite)

- **Layers 1-3 complete**: 83 Jest tests passing (unit, integration, component)
- **Layer 4 (E2E)**: Detox removed, Maestro to be added
- **Decision doc**: `docs/e2e-framework-decision.md` explains why Maestro over Detox
- **Detox work**: preserved at branch `feat/automated-test-suite-detox`
- **testID already added**: `terms-agreement-switch` in `src/screens/InitWallet.js`

## What to Do

### 1. Install Maestro CLI
```bash
brew install maestro
```
No npm dependency needed — Maestro is a standalone CLI tool, not a node package.

### 2. Create flow files
```
.maestro/
  flows/
    walletCreation.yaml    # Full create wallet flow
```

### 3. Wallet Creation Flow (walletCreation.yaml)

The flow should navigate:
1. **WelcomeScreen** → toggle terms switch → tap "Start"
2. **InitialScreen** → tap "New Wallet"
3. **NewWordsScreen** → read 24 words → tap "Next"
4. **BackupWords** → select 5 correct words (this is the complex part — need to read word position number, match against displayed options)
5. **ChoosePinScreen** → enter 6-digit PIN twice → tap start

Key Maestro features to use:
- `tapOn: "text"` for button taps
- `tapOn: { id: "terms-agreement-switch" }` for the testID switch
- `assertVisible: "text"` for verification
- `copyTextFrom` / `runScript` for reading word position numbers during BackupWords
- `repeat` for the 5-step word validation loop

### 4. App Requirements
- Build the app normally: `npm run ios` or `npm run android`
- Maestro connects to the running simulator/emulator — no special build needed
- Add more `testID` props as needed for reliable element selection

### 5. Run
```bash
# iOS
maestro test .maestro/flows/walletCreation.yaml

# Android
maestro test .maestro/flows/walletCreation.yaml
```

### 6. Key Source Files for the Flow
- `src/screens/InitWallet.js` — WelcomeScreen, InitialScreen, NewWordsScreen (testID on switch)
- `src/screens/BackupWords.js` — 5-step word validation, uses lodash shuffle, FeedbackModal
- `src/screens/ChoosePinScreen.js` — 6-digit PIN entry, STORE.initStorage, startWalletRequested
- `src/constants.js` — TERMS_OF_SERVICE_URL, PRIVACY_POLICY_URL

### 7. Document and Commit
- Update `docs/e2e-framework-decision.md` with Maestro results
- Update `docs/testing-ci-plan.md` with Maestro CI steps
- Commit and push
