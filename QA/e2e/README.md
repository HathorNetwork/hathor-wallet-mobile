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
| `tools/` | A small Node package of its own (wallet-lib 4.3.0, ct-crypto-node 0.5.0; `npm install` there once). `wallet.js` derives the app wallet's addresses from its seed, gives a peer wallet's shielded address, mints custom tokens (`mint <address> <deposit\|fee> <name> <symbol> <units> <treasury-seed-file>`), gives a run's funds back to genesis (`cleanup <evidence dir>`), and sends private outputs (temporary, see below). |
| `run.js` | The runner: `node QA/e2e/run.js --setup pn-fn-seed-multi [--scenarios <id>,...] [--dry-run] [--no-cleanup] [--no-record]`. Runs that setup's send scenarios and writes a results file to `QA/graph/runs/`; evidence goes to `evidence/` (git-ignored). |
| `bin/app-on-privnet.sh` | Points the app at the privnet before it starts, writing its storage as root. `--fresh` wipes it first. Refuses anything but an emulator: store builds share the app id, so a wipe on a phone would erase its wallet. |
| `lib/` | `sendFlow.js` turns a send scenario into a Maestro flow; `runOrder.js` orders a setup's scenarios; `recorder.js` records the screen; `timeline.js` turns Maestro's logs into the viewer's timeline. |
| `viewer/` | `viewer.html`, the run viewer; `bin/serve-viewer.js` serves the runs' viewers. |
| `flows/` | Maestro flows. `onboard.yaml`: new wallet on the privnet, ending on the dashboard. `import_tokens.yaml`: registers the minted tokens through the dashboard's "New tokens" banner. |

## How the flags work

The app on a local node (`localhost`, `127.0.0.1`, `[::1]` or `10.0.2.2`) fetches its flags from the fake Unleash on port 18042 of that host, instead of the real Unleash (`getUnleashUrl` in `src/sagas/featureToggle.js`), in debug and release builds alike, since runs use a release build. Public networks always read the real one: a public network's servers can misbehave with a flag on that they expect off.

The app fetches flags when it connects to a network and then every 15 s. Set flags before the app reaches the privnet and they apply from the start. A change mid-run takes up to 15 s; `--wait` returns once the app has fetched it.

`app-on-privnet.sh` writes the privnet into the app's storage before launch, so the app's very first flag fetch already goes to the fake Unleash. That keeps push notifications off from the start; with the e2e build's placeholder `google-services.json`, push on means an "Unexpected error" dialog. It also skips the Network Settings screens in setup.

## Custom tokens and the run order

After onboarding, the runner mints three tokens straight to the app wallet, from a treasury wallet that keeps the authorities: `E2E Deposit` (E2ED, 1000 tokens), `E2E Large` (E2EL, a deposit token of exactly 2^40 units, used only for the over-limit amounts) and `E2E Fee` (E2EF, 1000 tokens, fee-based). A separate token keeps the 2^40 units out of the other deposit scenarios: a balance above 2^40 makes a private send of the whole balance fail the 2^40 limit before it reaches the fee check. The app then imports them from the dashboard banner. E2EL's 1% deposit locks about 110M HTR of the privnet's 1B genesis, which the cleanup below frees.

All of a setup's scenarios share one wallet, so the order matters (`lib/runOrder.js`). The wallet starts with the tokens and no HTR, so the zero-HTR scenarios run first. The other scenarios each get 20 HTR first; failures run before successful sends, because failures spend nothing. The private over-limit check needs all 2^40 E2EL, so it runs before the public send that moves them.

## Cleanup: the run's funds go back to genesis

After the scenarios, even when the run stopped half-way, the runner gives back what it took (`cleanup` in `tools/wallet.js`): the app wallet and the peer send their deposit tokens to the treasury, which melts them and so frees their deposits, and all three send their HTR to the genesis address. Without it, E2EL's deposit would use up a privnet in about nine runs; with it, a run costs a few HTR: the fee-token fees, what the multisig destination received (the helper keeps its keys) and what the fee tokens hold (melting them frees nothing). Each step that fails is logged and the rest go on; `node QA/e2e/tools/wallet.js cleanup <evidence dir>` retries, and does nothing when there is nothing left. It refuses a `NODE_URL` off this machine. `--no-cleanup` keeps the funds, to look at the wallets after a run.

Both single-key destinations, `simple` and `shielded`, belong to the peer, a seed the runner holds (`peer.seed`), so what they receive comes back too.

## Watching a run

Every run records the emulator's screen through each flow but onboarding, whose screen shows the seed, with Android's own `screenrecord`: the device encodes, so a recording costs no time and is ready when the run ends (about 10 MB a minute). The run then writes `evidence/<run>/viewer.html`, the recordings as a playlist: the token import, then each scenario, in the order they ran, with the skipped ones listed and their reasons. Each recording plays beside its steps, the graph's (`1/4 address: type the simple address`, `2/4 amount: ...`, the expected outcome last) with their Maestro commands under them and the runner's own steps (a top-up, the adb taps that empty the address field) in italics. The running step is highlighted and captioned over the video; done ones get a tick or a cross; a click on a step seeks to it, and the strip under the video shows the steps and the long waits.

| Key | |
|---|---|
| `Q`, `S`, `W` | 1×, 1.5×, 2× |
| `←`, `→` | back, forward 5 s |
| `Space` | play, pause |
| `N`, `P` | next, previous recording |
| `L` | skip long waits, on or off |
| `V` | mark the scenario validated, or undo |

"Skip long waits" jumps over any stretch of more than 3 s where no command starts or ends (a wait for the app, the runner's sleeps), keeping a second at each end; seeking into one on purpose plays it. "Mark validated" keeps, in the browser, the version of the scenario's flow you watched: a hash of the generated flow, the same from run to run until the flow changes. The playlist marks scenarios validated or "changed since validated", and "Show: not validated, or changed since" plays only those, for a sample after a change.

The viewer is one HTML file with the run's data in it, and the recordings are files beside it, so it also works from a copy of them. To watch from another machine on the tailnet:

```bash
node QA/e2e/bin/serve-viewer.js &      # localhost:18090; serves only the viewers and the recordings
tailscale serve --bg 18090             # https://<this machine>.<tailnet>.ts.net/, tailnet only
```

The index there lists the runs. An evidence dir also holds the run's seeds and Maestro's logs, which `serve-viewer.js` doesn't serve, so copy only the viewer and the recordings when sharing a run. Runs from before onboarding stopped being recorded still show the seed: the server withholds their `onboard/screen.mp4`, but their `viewer.html` lists five of its words. `tailscale serve --https=443 off` stops it. Timing: the recording's first frame is taken from screenrecord's "Configuring recorder" line on the host clock, and Maestro times its commands on the host clock too; the steps match the screen to about 0.2 s. `--no-record` skips the recordings and the viewer.

## Scenarios held back

The runner lists these in each run as skipped, with the reason (`unrunnableReason` in `lib/sendFlow.js`), and they stay in the graph for manual QA: those that need a locked or broken-key private balance, and one on which the graph and the app disagree. `ROADMAP.md` has the finding and the next steps.

## Between scenarios

The Send tab keeps the last address typed, and a flow can't clear it reliably: `eraseText` deletes only what's before the cursor, and a tap can land mid-way through a 3-line shielded address. So before each scenario the runner taps into the field with adb and sends Ctrl+A, then Delete (`clearSendAddress` in `run.js`). Each flow then asserts that the field holds exactly the new address. Restarting the app instead also works, but takes about 1.5 min per scenario.

Maestro's on-device driver sometimes fails to start or dies under load (`MaestroDriverStartupException`, `DeviceServerDiedException`). The runner retries a flow once when the driver doesn't start. A crash during a flow still fails the scenario; re-run it with `--scenarios`. On a debug build, LogBox toasts ("Open debugger to view warnings") can also cover the tab bar.

## Temporary: private payments come from `tools/wallet.js send-private`

The funding helper's `POST /fund` (0.0.2) pays public addresses only: a shielded `K...` address gets a 500. Until it can pay a shielded address with a private output, `wallet.js send-private <address> <HTR> <amount|full>` does it: it funds a throwaway wallet through the helper, then sends from it with wallet-lib (the old kit's `sender.js`, moved here). When the helper gains that, use `/fund` instead and delete `sendPrivate`, its command, and `@hathor/ct-crypto-node` if nothing else needs it. The function's comment says the same.

## Selectors

Flows find what they tap, type into and read by the app's `testID`s (Maestro's `id:`, Android's resource-id), and check what the user should see by its text. A `testID` doesn't move with the layout, the screen size, the copy or the language; the outcomes' messages are what a scenario verifies, so they stay text.

- Ids are kebab-case, `<screen or component>-<element>`: `send-amount-next`, `transaction-privacy-done`. Repeated elements end in a stable key, never in translated text or user data: `numpad-key-1`, `privacy-mode-switch-hide_amount` (the app's mode), `new-words-word-3` (a position).
- A shared component takes a `testID` prop and puts it on its native view (`NewHathorButton`, `TokenBox`, `InputLabel`, `PrivacyModeSelector`); one shown once, whatever the screen, sets its own (`NumPad`, `PrivacyModeCard`).
- Put the id on a view that is on screen where a tap lands: Maestro taps an element's centre. The tab bar's buttons reach under Android's navigation bar, so the ids `tab-home`, `tab-send` and so on are on the tabs' icons, in a view kept with `collapsable={false}` so React Native doesn't flatten it away.
- A `<Text>` inside another `<Text>` is part of its parent on Android, with no view of its own, so its `testID` never shows: the dashboard banner's "Import tokens" link is found by its text.
- A modal's backdrop can't be tapped by id, since its centre is under the modal: the success modal after the backup check, which has no button, is closed with a tap at a screen point.

The runner reads ids too: it finds where to tap with adb (`centreOf` in `run.js`) from a uiautomator dump.

## The e2e build

Runs use the `e2e` build type (`android/app/build.gradle`): the release build, with its JS bundled and no dev mode, which may also talk plain HTTP to a node on the device or its host (`android/app/src/e2e`); a release build allows only HTTPS, and the privnet is plain HTTP. It needs no Metro, shows no LogBox toasts, and has no dev keys to trip on.

`app-on-privnet.sh` writes the app's storage as root (`adb root`), which the emulator allows on an image without Play Store (the `default` system image), so it works on a build that isn't debuggable. A debug build with Metro still runs: the runner records which build it found in the results file.

## Run

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 MAESTRO_CLI_NO_ANALYTICS=1 ANDROID_HOME=~/Android/Sdk
# The app: the checkout needs the placeholder android/app/google-services.json and the generated
# translations (src/locale/*/texts.po.json). Cold about 4 min, about 1.5 min after a JS change.
(cd android && ./gradlew assembleE2e -PreactNativeArchitectures=x86_64)
cd QA/e2e/privnet && docker compose up -d && cd ..
~/Android/Sdk/emulator/emulator -avd hnni -no-window -no-audio -no-snapshot -gpu swiftshader_indirect &
adb install -r ../../android/app/build/outputs/apk/e2e/app-e2e.apk
node run.js --setup pn-fn-seed-multi
```

To drive one flow by hand: `bin/app-on-privnet.sh --fresh`, then `~/.maestro/maestro/bin/maestro test flows/onboard.yaml`.

Always tear down afterwards, or the miner and the emulator keep the CPU busy: `adb emu kill` and `docker compose down` in `privnet/`. With a debug build, also stop Metro and close the React Native DevTools windows it opened (`close_devtools` in the `mobile-e2e-flows` kit).
