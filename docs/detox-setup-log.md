# Detox E2E Setup — Troubleshooting Log

## Status: App launches but Detox times out waiting for JS ready state

## Environment
- Xcode 16.2, macOS (Darwin 25.3.0)
- React Native 0.77.2 (bare workflow)
- Detox 20.x
- Simulator: iPhone 16 (iOS 18.2)

## What Works
- `npm test` → 83 Jest tests pass (Layers 1-3 of the PoC)
- `npm run ios` → builds and launches the app (uses Xcode default DerivedData)
- `npx detox build --configuration ios.sim.debug` → BUILD SUCCEEDED (after fix below)

## Issues Encountered and Resolutions

### 1. AssetCatalogSimulatorAgent spawn failure (RESOLVED)
**Error:** `Failed to launch AssetCatalogSimulatorAgent via CoreSimulator spawn`
**Root cause:** Xcode 16.2 bug — when `-derivedDataPath` is passed to `xcodebuild`, the asset catalog compiler can't spawn its simulator agent.
**Fix:** Remove `-derivedDataPath ios/build` from the Detox build command. Use Xcode's default DerivedData path instead. Updated `.detoxrc.js` to:
- `build`: `xcodebuild ... -destination "platform=iOS Simulator,name=iPhone 16"` (no `-derivedDataPath`)
- `binaryPath`: Point to `~/Library/Developer/Xcode/DerivedData/HathorMobile-<hash>/Build/Products/Debug-iphonesimulator/HathorMobile.app`
**Caveat:** The DerivedData hash (`cbapwsfseepdpbcjvvcfzhzwkjyf`) is machine-specific. Other developers need to find their own hash or use a script.

### 2. react-native-mmkv missing (RESOLVED)
**Error:** `Unable to resolve module react-native-mmkv`
**Root cause:** `react-native-mmkv` was never in `package.json` — it was a phantom dependency in `node_modules` from a prior install. Our `npm install` cleaned it out.
**Fix:** Run `npm run setup` (the project's documented setup command) to do a clean install. mmkv was never needed — the error was from a stale Metro cache.

### 3. Node polyfills (crypto, etc.) missing (RESOLVED)
**Error:** `Unable to resolve module crypto`
**Root cause:** `npm install` of test deps doesn't run `rn-nodeify --hack` which installs crypto/stream/buffer polyfills.
**Fix:** Always use `npm run setup` instead of plain `npm install`. Or run manually: `rn-nodeify --install stream,process,path,events,crypto,console,buffer,zlib --hack && npx patch-package`

### 4. applesimutils not installed (RESOLVED)
**Error:** `Command failed: applesimutils --version`
**Fix:** `brew tap wix/brew && brew install applesimutils`

### 5. Detox framework cache not built (RESOLVED)
**Error:** `Detox.framework could not be found`
**Fix:** `npx detox clean-framework-cache && npx detox build-framework-cache`

### 6. App launches but Detox times out (KNOWN FRAMEWORK BUG)
**Error:** `The app has not responded to the network requests below: (id = -1000) isReady: {}`
**Symptom:** App launches in simulator, Detox's websocket connects on port 55728, but app never responds with "ready".
**Root cause:** Known Detox issue with React Native 0.76+ on iOS — [wix/Detox#4803](https://github.com/wix/Detox/issues/4803). Detox's synchronization mechanism times out because RN's new architecture blocks the main dispatch queue during initialization. The app itself is fine (it works via `npm run ios`).
**Resolution:** The actual root cause was recurring 1-second JS timers (Unleash feature flag polling, websocket keepalive) that keep Detox sync perpetually "busy". Detox 20.37.0+ officially supports RN 0.77 with New Architecture.
**Fix:** Launch with `detoxEnableSynchronization: 0` and use `waitFor(...).withTimeout()` for all assertions. First test passes.

### 7. UISwitch tap doesn't fire onValueChange in Fabric (CURRENT BLOCKER)
**Error:** Detox finds and taps `UISwitch` / `RCTSwitchComponentView` (by.type, by.id, tap, longPress all succeed without error), but React Native's `onValueChange` callback is never invoked.
**Root cause:** In Fabric (New Architecture), native UISwitch event dispatching bypasses the old bridge. Detox's tap simulation doesn't trigger Fabric's event pipeline for Switch components.
**Impact:** Any test that toggles a `<Switch>` is blocked. The WelcomeScreen terms agreement is the first interaction.
**Attempted:** `tap()`, `longPress()`, `swipe()`, `tap({x,y})`, `by.type('UISwitch')`, `by.type('RCTSwitchComponentView')`, `by.id('testID')` — all find the element but none fire the callback.
**Potential solutions:**
1. Replace `<Switch>` with a `TouchableOpacity`-based toggle in the app code
2. Use Maestro instead (operates at accessibility layer, not native view layer)
3. Wait for a Detox fix for Fabric Switch interaction

## Approaches That Don't Work
- `pod install --repo-update` → CocoaPods CDN intermittently fails with HTTP/2 framing errors
- Adding `-derivedDataPath` to xcodebuild on Xcode 16.2 → triggers AssetCatalogSimulatorAgent spawn error
- Manually spawning AssetCatalogSimulatorAgent → fails with error code 153
- Killing CoreSimulatorService and rebooting simulator → does not fix the -derivedDataPath issue
- `ASSETCATALOG_COMPILER_SKIP_APP_STORE_DEPLOYMENT=YES` flag → no effect
