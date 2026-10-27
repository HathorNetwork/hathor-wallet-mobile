# Mobile e2e on the local privnet

Runs the app's money paths end to end on an Android emulator against a local stand-in for the Shielded Testnet, with every feature flag under the test run's control. The scenarios to run come from the QA feature graph (`QA/graph/`). This kit is early and exploratory: names, ids and layout will change.

The host setup (KVM, JDK 17, NDK, Maestro, the AVD) and the Android and Maestro gotchas are in the `mobile-e2e-flows` kit's README, which this one grows out of.

## Layout

| Path | What it is |
|---|---|
| `privnet/` | docker compose: the shielded fullnode (host port 18083), the dev miner (18035), the fake Unleash (18042) and wallet-lib's integration-test helper for funding (13020). Blocks are weight 1, so the miner sits near idle. |
| `unleash/` | The fake Unleash: `server.js`, and `flags.json`, the flags it starts with (real testnet values, plus the shielded flags on, push and wallet service off). |
| `bin/flags.js` | Lists and sets the flags: `flags.js set fee-based-tokens.rollout=off --wait`. |
| `bin/fund.js` | Sends HTR from the genesis wallet to a public address: `fund.js W... 10.50`. Uses the helper's `POST /fund`; shielded addresses are refused. |
| `tools/` | A small Node package of its own (wallet-lib 4.3.0, ct-crypto-node 0.5.0; `npm install` there once). `wallet.js` derives the app wallet's addresses from its seed, gives a peer wallet's shielded address, and sends private outputs (temporary, see below). |
| `run.js` | The runner: `node QA/e2e/run.js --setup pn-fn-seed-multi [--scenarios <id>,...] [--dry-run]`. Runs that setup's send scenarios and writes a results file to `QA/graph/runs/`; evidence goes to `evidence/` (git-ignored). |
| `bin/app-on-privnet.sh` | Points the debug app at the privnet before it starts. `--fresh` wipes it first. |
| `flows/` | Maestro flows. `onboard.yaml`: new wallet on the privnet, ending on the dashboard. |

## How the flags work

A debug build whose node is local (`localhost`, `127.0.0.1`, `[::1]` or `10.0.2.2`) fetches its flags from the fake Unleash on port 18042 of that host, instead of the real Unleash (`getUnleashUrl` in `src/sagas/featureToggle.js`). Release builds and public networks always read the real one: a public network's servers can misbehave with a flag on that they expect off.

The app fetches flags when it connects to a network and then every 15 s. Set flags before the app reaches the privnet and they apply from the start. A change mid-run takes up to 15 s; `--wait` returns once the app has fetched it.

`app-on-privnet.sh` writes the privnet into the app's storage before launch, so the app's very first flag fetch already goes to the fake Unleash. That keeps push notifications off from the start; with the e2e build's placeholder `google-services.json`, push on means an "Unexpected error" dialog. It also skips the Network Settings screens in setup.

## Temporary: private payments come from `tools/wallet.js send-private`

The funding helper's `POST /fund` (0.0.2) pays public addresses only: a shielded `K...` address gets a 500. Until it can pay a shielded address with a private output, `wallet.js send-private <address> <HTR> <amount|full>` does it: it funds a throwaway wallet through the helper, then sends from it with wallet-lib (the old kit's `sender.js`, moved here). When the helper gains that, use `/fund` instead and delete `sendPrivate`, its command, and `@hathor/ct-crypto-node` if nothing else needs it. The function's comment says the same.

## Run

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 MAESTRO_CLI_NO_ANALYTICS=1
cd QA/e2e/privnet && docker compose up -d && cd ..
~/Android/Sdk/emulator/emulator -avd hnni -no-window -no-audio -no-snapshot -gpu swiftshader_indirect &
npx react-native start --port 8081 &          # from the checkout under test, with its debug APK installed
bin/app-on-privnet.sh --fresh
~/.maestro/maestro/bin/maestro test --test-output-dir=/tmp/e2e-run flows/onboard.yaml
node bin/flags.js set shielded-outputs.rollout=off --wait
```

Always tear down afterwards, or the miner and the emulator keep the CPU busy: `adb emu kill`, stop Metro, `docker compose down` in `privnet/`, and close the React Native DevTools windows Metro opened (`close_devtools` in the `mobile-e2e-flows` kit).
