# Passkey onboarding (PoC-1: passkey PRF → seed)

Experimental "Continue with passkey" onboarding: a WebAuthn passkey's **PRF** secret (32 bytes,
deterministic per credential + salt, never leaves the secure element, synced/backed-up by iCloud
Keychain / Google Password Manager) becomes the **BIP39 entropy** for an otherwise ordinary Hathor
HD wallet. The user does Face ID; no 24 words are shown; "backup" is the passkey's own platform
sync. Everything below the passkey layer is unchanged.

Zero consensus / network change — the wallet is a normal secp256k1 HD wallet on the same network.

## What was added

| File | Purpose |
|---|---|
| `src/passkey/passkeyService.js` | The passkey/PRF layer: register + get PRF secret via `react-native-passkey`, derive 24 words (`new Mnemonic(Buffer.from(prf32)).phrase`). Dev mock behind the same interface. |
| `src/components/PasskeyOnboardingButton.js` | Gated "Continue with passkey" button. Renders **nothing** unless the feature toggle is on. On success, navigates to the existing `ChoosePinScreen` with `{ words }`. |
| `src/constants.js` | `PASSKEY_ONBOARDING_FEATURE_TOGGLE` (+ default `false`); `PASSKEY_RP_ID` / `PASSKEY_RP_NAME` / `PASSKEY_USE_MOCK`. |
| `src/screens/InitWallet.js` | Renders the button in `InitialScreen`'s button row. |
| `ios/HathorMobile/HathorMobile.entitlements` | Associated Domains (`webcredentials:wallet.hathor.dev`). |
| `package.json` | `react-native-passkey ^3.3.0` (PRF support: iOS 18+ / Android Credential Manager). |

The integration point is deliberately tiny: the derived `words` string enters the **existing**
`ChoosePinScreen → STORE.initStorage(words, pin) → startWalletRequested` pipeline, identical to the
"Import Wallet" flow. No changes to storage, encryption, biometrics, or the wallet boot saga.

## Enabling it

1. **Install deps — use the repo's full `setup`, NOT a bare `npm install`.** The app shims Node
   built-ins (`path`, `stream`, `crypto`, …) via `rn-nodeify --hack`; without it, Metro fails to
   bundle with `Unable to resolve module path` (the seed derivation imports pull those in):
   ```sh
   npm run setup          # npm install + allow-scripts + rn-nodeify --hack + patch-package
   cd ios && pod install && cd ..
   ```
2. **Turn on the feature toggle** `passkey-onboarding.rollout` in Unleash (or temporarily default it
   to `true` in `src/constants.js` `FEATURE_TOGGLE_DEFAULTS` for local testing). When off, onboarding
   is exactly as before.

## On-device prerequisites (required for REAL passkeys)

Platform passkeys are **domain-bound**. Before real passkey create/get works on a device:

1. **Own a domain** and set `PASSKEY_RP_ID` in `src/constants.js` to it (default `wallet.hathor.dev`).
2. **iOS Associated Domains:** the entitlement `webcredentials:<PASSKEY_RP_ID>` is already added.
   Host `https://<PASSKEY_RP_ID>/.well-known/apple-app-site-association` (served as
   `application/json`, HTTP 200, no redirect) containing this app's Team ID + bundle ID:
   ```json
   { "webcredentials": { "apps": ["55SHY647CG.network.hathor.wallet"] } }
   ```
   (Team ID `55SHY647CG`, bundle ID `network.hathor.wallet` — from the Xcode project.)
3. **Android — Digital Asset Links (DONE):** `https://wallet.hathor.dev/.well-known/assetlinks.json`
   is served by the same web deploy (`passkey-wallet-poc/apps/web/deploy/assetlinks.json`), binding
   package `network.hathor.wallet` to its signing cert. Android's Credential Manager verifies the
   rpId through this file — no entitlement/manifest change is needed on Android.
   **⚠ PoC caveat:** the fingerprint published is the repo's `android/app/debug.keystore`, which is
   the STANDARD Android SDK debug key (both debug and release build types currently sign with it,
   see `android/app/build.gradle`). That means any dev machine can produce an app passing DAL for
   this domain. Fine for the PoC; for production, sign with a real release keystore and replace the
   fingerprint (get it via `keytool -list -v -keystore <ks> | grep SHA256`).
4. **Runtime requirements:** iOS 18+ for the PRF extension; on Android, passkeys + PRF need Google
   Play Services with Google Password Manager (recent Android; PRF support is GPM-version-gated).
   On unsupported devices the flow surfaces a clear "PRF unsupported" error rather than crashing.

## Testing the flow BEFORE the domain infra exists

Set `PASSKEY_USE_MOCK = true` in `src/constants.js` (or `__DEV__`). This bypasses the native passkey
with a **deterministic dev-only secret**, so the entire onboarding → PIN → wallet flow is exercisable
immediately in a simulator. **Never ship funds on a mock-derived wallet** — every install with the
same user label derives the same seed. Flip back to `false` once the domain + AASA are live.

## Known limitations / follow-ups

- **Android (wired 2026-07-07):** `react-native-passkey` uses androidx Credential Manager
  (autolinked; no gradle/manifest change). The JS layer normalizes the `Uint8Array` PRF salt to
  base64url on Android automatically, so `passkeyService.js` is shared unchanged. The wallet-name
  dialog is an in-modal name step on BOTH platforms (`Alert.prompt` is iOS-only and the in-modal UX
  is nicer); on iOS a `keyboardWillShow` listener grows the sheet's bottom padding so the input
  stays above the keyboard (Android uses `windowSoftInputMode=adjustPan`). Test on a device with
  Google Play Services + Google Password Manager as the passkey provider.
- **Emulator testing:** needs a Google Play image (API 34+), a signed-in Google account, a screen
  lock set, and updated Play services. If GPM only offers "Use a different phone or tablet" (QR),
  the local device can't hold passkeys yet (usually no screen lock) — and the QR/hybrid flow can
  NEVER complete on an emulator because it requires Bluetooth proximity, which emulators lack.
- **Two Face ID prompts** on onboarding when the platform only returns PRF on assertion (create +
  get). The code uses the create-time PRF result when the platform provides it, to avoid the second
  prompt.
- **Two actions**: "Create passkey wallet" (`createWalletWordsFromPasskey`, mints a NEW passkey) vs
  "Sign in with passkey" (`signInWalletWordsFromPasskey`, discoverable assertion — no
  `allowCredentials` — so the OS lists existing iCloud/GPM-synced passkeys). Sign-in re-derives the
  SAME seed, which is what makes a wallet survive a reset / reinstall / new device. Do NOT collapse
  these into one "create" call — that mints a new wallet every time and the old one is unreachable.
- **Naming (design B).** "Create passkey wallet" shows an in-modal name input (both platforms)
  and sets the name as the passkey `displayName`, so
  the OS sign-in picker distinguishes wallets. **Apps cannot enumerate passkeys** (WebAuthn privacy):
  the "list of your wallets" is the **native OS picker** shown during discoverable sign-in, not an
  in-app screen. An in-app list would require a separate iCloud-synced registry of names→credentialId.
- **`react-native-passkey` result shape** may shift across versions; `digPrfFirst()` reads the PRF
  result defensively and should be confirmed against the installed version's types.
- Strategic context: this is PoC-1 (passkey-as-seed). See `Hathor/passkey-wallet-poc/docs/` for how
  it fits the broader account-model exploration (it is a near-term UX win, not the end-state design).
