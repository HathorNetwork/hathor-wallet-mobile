# E2E Framework Decision: Detox vs Maestro vs Appium

## Context

The Hathor Mobile Wallet (React Native 0.77.2, bare workflow) needs an E2E testing framework for critical user flows — wallet creation, transactions, and settings. The app uses React Native's **New Architecture (Fabric + TurboModules)** enabled by default, and includes complex native integrations (SES lockdown, WalletConnect, Firebase, Keychain).

This document records the evaluation process and rationale for framework selection.

## Candidates Evaluated

### 1. Detox (Wix) — Gray-box, RN-specific

**Strengths:**
- Purpose-built for React Native with deep bridge integration
- Gray-box approach: synchronizes with RN's JS thread to eliminate timing flakiness
- Tests written in JavaScript/TypeScript (familiar to the team)
- Officially claims RN 0.77 + New Architecture support (Detox 20.37.0+)
- Flakiness rates below 2% in teams that use it successfully
- Tests run 2-3x faster than black-box alternatives in RN environments

**What we built and tested (branch: `feat/automated-test-suite-detox`):**
- Detox 20.50.1 installed and configured
- Build succeeds after working around Xcode 16.2 AssetCatalog bug (removed `-derivedDataPath` flag)
- App launches in simulator, first E2E test passes ("Welcome screen" renders)

**Why we moved on:**

1. **UISwitch interaction broken in Fabric mode.** Detox can find and tap native `UISwitch` / `RCTSwitchComponentView` elements (by testID, by type, tap, longPress, swipe — all succeed without error), but React Native's `onValueChange` callback is never invoked. This blocks any test that toggles a `<Switch>` component. The WelcomeScreen terms agreement toggle is the very first interaction in the wallet creation flow.

2. **Synchronization deadlock with recurring timers.** The app has 1-second recurring JS timers (Unleash feature flag polling, WebSocket keepalive) that prevent Detox's auto-sync from ever detecting an "idle" state. This required disabling synchronization entirely (`detoxEnableSynchronization: 0`) and using manual `waitFor` timeouts — which negates Detox's primary advantage (auto-sync).

3. **DetoxSync swizzle failures with Fabric.** On app launch, DetoxSync logs:
   ```
   DTXSwizzleMethod: original method initWithModule:uiManager: not found for class REANodesManager
   DTXSwizzleMethod: original method _setDirty not found for class UIGestureRecognizer
   ```
   This indicates DetoxSync can't hook into Reanimated or gesture handler in Fabric mode, further undermining its gray-box capabilities.

4. **Known open issues.** Multiple Detox GitHub issues document these problems:
   - [#4803](https://github.com/wix/Detox/issues/4803) — isReady timeout with RN 0.76+ (closed as stale, not resolved)
   - [#4506](https://github.com/wix/Detox/issues/4506) — Deadlock during start with New Architecture (closed as stale)
   - [#4842](https://github.com/wix/Detox/issues/4842) — Tests fail with RN 0.81 + New Architecture (closed as stale)

**Conclusion:** Detox's gray-box model, while theoretically superior for RN, doesn't reliably work with the New Architecture as of Detox 20.50.1 (March 2026). The auto-sync advantage is nullified by the timer issue, and the Switch interaction bug is a hard blocker for our specific flow. The issues have been reported for over a year without resolution from the Detox team (all closed by stale bot, not by fixes).

### 2. Maestro (mobile.dev) — Black-box, declarative YAML

**Strengths:**
- Declarative YAML syntax — accessible to QA engineers without programming background
- Operates at the **accessibility layer**, not the native view layer — architecture-agnostic
- Zero instrumentation: no changes to app code, no native module injection
- Automatic retry on flaky assertions (built-in resilience)
- Works with New Architecture by design (doesn't depend on RN bridge)
- Quick setup: no Xcode scheme changes, no Podfile modifications
- Active development with cloud testing service available
- Cross-platform tests: same YAML works on iOS and Android

**Weaknesses:**
- Black-box only: no visibility into RN state, Redux, or JS execution
- Less precise for timing-sensitive operations (no thread synchronization)
- YAML is less flexible than JavaScript for conditional logic or data extraction
- Smaller community specifically for React Native (compared to Detox)
- Requires elements to have accessibility labels or testID for reliable selection

**Why it fits this project:**
- The UISwitch problem doesn't exist: Maestro interacts via accessibility, which fires RN callbacks correctly
- No timer synchronization issue: Maestro doesn't try to detect "idle" state
- The team can start writing tests immediately without understanding RN internals
- Works identically regardless of Old/New Architecture, Fabric, Bridgeless, etc.

### 3. Appium — Black-box, cross-platform standard

**Strengths:**
- Industry standard WebDriver protocol
- Language-agnostic test authoring (JS, Python, Java, etc.)
- Largest ecosystem and community
- Works with any mobile app (not RN-specific)

**Weaknesses:**
- Slowest of the three frameworks
- Most complex setup and infrastructure requirements
- Black-box with no RN awareness
- Notoriously flaky without careful wait strategies
- Overkill for a single React Native application

**Conclusion:** Appium's overhead doesn't justify its benefits for a dedicated RN project. The team would spend more time fighting infrastructure than writing tests.

## Decision

**Selected: Maestro**

| Criterion | Detox | Maestro | Appium |
|-----------|-------|---------|--------|
| New Architecture support | Broken (Switch, sync) | Works (accessibility layer) | Works (black-box) |
| Setup complexity | High (pods, schemes, build) | Low (brew install, YAML) | Very high |
| Test authoring | TypeScript | YAML | Any language |
| Auto-sync / flakiness | Broken with recurring timers | Built-in retry | Manual waits |
| QA team accessibility | Dev-only | Anyone who reads YAML | Dev-only |
| No app code changes needed | No (needs testIDs, workarounds) | Minimal (testIDs help but text works) | No |
| CI integration | Complex (simulator build) | Straightforward | Complex |
| Community for RN | Large but issues unresolved | Growing, active | Large but generic |

**Primary reason:** Detox's gray-box advantage is currently non-functional with our stack (RN 0.77 + Fabric + Reanimated + recurring timers). Without auto-sync working, Detox becomes a black-box framework with extra complexity and known bugs. Maestro is a better black-box framework — simpler, more reliable, and architecture-agnostic.

**Risk acknowledged:** Maestro's black-box nature means we can't assert on Redux state or JS-level behavior. This is acceptable because our Layers 1-3 (Jest unit, integration, and component tests — 83 tests) already cover internal logic thoroughly. The E2E layer's role is to validate that the user-facing flow works end-to-end, which is exactly what Maestro excels at.

## References

- Detox work preserved at branch: `feat/automated-test-suite-detox`
- Detailed troubleshooting log: `docs/detox-setup-log.md`
- [Detox vs Maestro vs Appium: React Native E2E 2026](https://www.pkgpulse.com/blog/detox-vs-maestro-vs-appium-react-native-e2e-testing-2026)
- [Maestro React Native setup guide](https://docs.maestro.dev/get-started/supported-platform/react-native)
- [Our Experience Adding E2E Testing to React Native with Maestro (2026)](https://addjam.com/blog/2026-02-18/our-experience-adding-e2e-testing-react-native-maestro/)
