# E2E Framework Decision: Detox vs Maestro vs Appium

## Context

The Hathor Mobile Wallet (React Native 0.77.2, bare workflow) needs an E2E testing framework for critical user flows — wallet creation, transactions, and settings. The app uses React Native's **New Architecture (Fabric + TurboModules)** enabled by default, and includes complex native integrations (WalletConnect, Firebase, Keychain) and security hardening via **@lavamoat/react-native-lockdown** (SES).

This document records the evaluation process, hands-on testing results, and rationale for framework selection.

## Candidates Evaluated

### 1. Detox (Wix) — Gray-box, RN-specific

**Strengths:**
- Purpose-built for React Native with deep bridge integration
- Gray-box approach: synchronizes with RN's JS thread to eliminate timing flakiness
- Tests written in TypeScript (same language as the app)
- Integrated build step: `detox build` wraps `xcodebuild`/`gradle`, enabling release-build testing in a single command
- Can test release builds natively (`ios.sim.release` configuration)

**What we built and tested:**
- Detox 20.50.1 installed and configured (branch: `experiment/detox-with-fixes`)
- 3 Detox tests pass: WelcomeScreen → InitialScreen → BackupWords
- App launches, taps work, navigation works after applying Fabric workarounds

**Concerns for this project:**

1. **LavaMoat/SES compatibility risk.** Detox injects gray-box instrumentation into the app's JavaScript runtime to synchronize with the RN bridge and detect idle state. The app uses `@lavamoat/react-native-lockdown` which applies SES (Secure EcmaScript) to freeze JavaScript globals and prevent prototype pollution. Detox's runtime instrumentation could conflict with SES lockdown, requiring ongoing effort to maintain compatibility as either Detox or LavaMoat updates. This is a maintenance burden with no clear upside.

2. **Synchronization deadlock with recurring timers.** The app has 1-second recurring JS timers (Unleash feature flag polling, WebSocket keepalive) that prevent Detox's auto-sync from ever detecting an "idle" state. This required disabling synchronization entirely (`detoxEnableSynchronization: 0`), which negates Detox's primary advantage over black-box tools.

3. **Heavy npm dependency footprint.** Detox adds `detox`, `jest-circus`, and transitive native dependencies to the project. These must be maintained, updated, and audited — adding to the LavaMoat `allowScripts` configuration burden.

### 2. Maestro (mobile.dev) — Black-box, declarative YAML

**Strengths:**
- Operates at the **accessibility layer** — architecture and runtime agnostic
- Zero instrumentation: no code injected into the app, no native module dependencies
- Declarative YAML syntax — accessible to QA engineers without TypeScript knowledge
- Standalone CLI tool: no npm dependencies added to the project
- Automatic retry on flaky assertions (built-in resilience)
- Cross-platform: same YAML works on iOS and Android
- Active development; used by Meta for React Native framework testing

**What we built and tested:**
- Maestro 2.4.0 installed and configured (branch: `feat/automated-test-suite`)
- Full wallet creation E2E flow passes: WelcomeScreen → InitialScreen → NewWordsScreen → BackupWords (5-step word validation) → ChoosePinScreen (PIN entry + confirmation) → Wallet start
- 30+ steps across 5 screens, all passing

**Weaknesses:**
- Black-box only: no visibility into Redux state, JS execution, or async operations
- No integrated build step: requires a separately built and running app
- YAML is less flexible than TypeScript for complex conditional logic
- Requires external JS scripts for operations like word lookup during BackupWords validation

### 3. Appium — Black-box, cross-platform standard

**Conclusion:** Appium's overhead doesn't justify its benefits for a dedicated RN project. The team would spend more time fighting infrastructure than writing tests. Not evaluated hands-on.

## Decision

**Selected: Maestro**

### Primary reason: LavaMoat/SES compatibility

The app's security model relies on `@lavamoat/react-native-lockdown` to freeze JavaScript globals via SES. Detox's gray-box approach injects instrumentation into the JavaScript runtime to synchronize with the RN bridge, detect idle state, and intercept network requests. This instrumentation could conflict with SES lockdown in unpredictable ways — either now or after future updates to either library.

Maestro operates entirely outside the app's runtime. It interacts through the OS accessibility layer (XCUITest on iOS, UIAutomator on Android) and never touches the JavaScript environment. This makes it **inherently compatible with SES lockdown** and eliminates an entire class of maintenance risk.

### Secondary reasons

| Criterion | Detox | Maestro |
|-----------|-------|---------|
| LavaMoat/SES risk | Gray-box instrumentation may conflict | Zero risk — fully external |
| npm dependency impact | Heavy (detox + jest-circus + native deps, allowScripts config) | None (standalone CLI) |
| Auto-sync with our app | Broken (recurring timers force `sync: 0`) | N/A — black-box by design |
| QA team accessibility | Developers only (TypeScript) | Anyone who reads YAML |
| Full flow tested? | 3 steps (PoC) | 30+ steps (complete) |
| CI integration | Simpler build+test combo | Needs separate build step |

### Risk acknowledged

Maestro's black-box nature means we can't assert on Redux state or JS-level behavior. This is acceptable because our Layers 1-3 (83 Jest tests covering units, sagas, and components) already cover internal logic thoroughly. The E2E layer's role is to validate that the **user-facing flow works end-to-end**, which is exactly what Maestro excels at.

### Detox remains viable

Detox works with our codebase (proven on branch `experiment/detox-with-fixes`). If future requirements demand gray-box capabilities (e.g., testing async wallet sync behavior, asserting on Redux state during E2E), switching to Detox would require minimal effort since the same app-level workarounds support both frameworks.

## React Native Fabric Workarounds (required by both frameworks)

During evaluation, we discovered several React Native 0.77 + Fabric (New Architecture) issues that affect **all** XCUITest-based E2E tools. These workarounds are in the production code and benefit both Detox and Maestro:

1. **Native `<Switch>` replaced with custom `ToggleSwitch`** — UISwitch doesn't fire `onValueChange` via XCUITest in Fabric mode. Custom Pressable-based component works correctly.

2. **`TouchableOpacity` replaced with `Pressable` in `NewHathorButton`** — TouchableOpacity doesn't respond to XCUITest taps in Fabric. Pressable does.

3. **Buttons moved outside `flex: 1` containers** — Views with `flex: 1, justifyContent: 'flex-end'` intercept XCUITest taps intended for child elements. Buttons are now siblings after an empty spacer View.

4. **`testID` props added to interactive elements** — Enables reliable element targeting by both frameworks.

## Test Coverage Analysis

### What E2E tests cover (regardless of framework)

- Full user flows (wallet creation, navigation between screens)
- Native module integration (Keychain, AsyncStorage, Firebase — genuinely called on simulator)
- UI rendering and interaction on a specific device model
- React Navigation stack transitions
- Component state management (switch toggles, PIN input, word validation)

### What E2E tests do NOT cover

| Gap | Why | Mitigation |
|-----|-----|------------|
| Cross-device rendering | Simulator tests one device model | Manual QA on device matrix |
| Release build bugs | Debug builds skip Hermes bytecode compilation, ProGuard | Run E2E against release builds in CI |
| Real network conditions | Simulator uses host network | Manual QA on cellular/WiFi edge cases |
| OS permissions (camera, biometry, notifications) | Automation can't trigger system dialogs | Manual QA |
| Visual regressions | Functional tests don't check "does it look right" | Visual regression tools or manual QA |
| Hardware-specific bugs | Emulators miss device-specific quirks | Real device testing |

### Recommended test ratio

- **70% Unit tests (Jest)**: Business logic, utilities, reducers, saga helpers
- **20% Component tests (RNTL)**: Screen rendering, user interactions, navigation mocking
- **10% E2E tests (Maestro)**: Critical user journeys only (wallet creation, send transaction, restore wallet)

## References

- Detox PoC: branch `experiment/detox-with-fixes` (3 tests passing)
- Maestro PoC: branch `feat/automated-test-suite` (full flow passing)
- Detox evaluation log: `docs/detox-setup-log.md`
- CI integration plan: `docs/testing-ci-plan.md`
- PR review guide: `docs/pr-review-guide.md`
