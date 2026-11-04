# e2e roadmap: from the send scenarios to the whole app

Status on 2026-11-04. The kit runs the QA graph's send scenarios of one setup (`pn-fn-seed-multi`: the local privnet, fullnode facade, a seed wallet) on an Android emulator, records them, and shows them in a viewer for a person to check. This file is where it stands, what holds it back, and the way to the whole app.

## Where it stands

| | |
|---|---|
| Graph | 43 features, 13 setups, 4 actions modelled (send, create-token, receive, history): 235 scenarios. |
| Automated | Send on `pn-fn-seed-multi`: 24 scenarios, 13 run and pass. 11 are held back and stay in the graph, listed in each run with their reason: 10 need a locked or broken-key private balance, and one waits on the finding below. |
| Official QA (`QA/QA*.md`) | About 33 of its 756 numbered steps run automatically (4%). In the areas the kit targets (send, the deposit and fee token sends, multisig, importing tokens, private sends) it's about half. |
| Funds | A run gives its HTR and token deposits back to genesis: a privnet lasts hundreds of thousands of runs. |
| Watching | Every flow is recorded with `screenrecord`, at no cost in time, into a playlist viewer with the steps beside the screen, long waits skipped, speeds and seeks on keys, and per-scenario validation marks. |

### Measured timings

| | |
|---|---|
| Setup of one wallet (fresh install, onboarding, mint, import) | about 3 min |
| A scenario that ends in an error | about 1.0 min |
| A scenario that sends | about 1.5 min |
| A failing scenario (a 60 s timeout) | about 2.2 min |
| Average per scenario, with the top-up and the return to the dashboard | about 1.3 min |
| Recording | about 10 MB a minute of video |

## Findings

What the kit found in the app, still to decide.

- **The zero-HTR message of a private send.** `shielded.deposit.hide-amount.max.zero-htr` sends a whole deposit-token balance with Hide amount, from a wallet with no HTR. The graph expects "Insufficient HTR to cover the privacy fees of this transaction.", the message a Private send of 1.50 shows. The app shows "Insufficient HTR to cover this transaction and its fees.": wallet-lib throws "Token: 00. Insufficient amount of tokens to fill the amount." and `mapTxError` maps it to the generic message. That message looks misleading, since only the privacy fee needs HTR here. Which axis flips it, the whole balance or Hide amount, is untested. The graph's rule is unverified too, so either side may be the one to change. The runner holds the scenario back until this is decided; removing the check in `unrunnableReason` brings it back.

## Next steps for the held-back scenarios

1. Decide the finding above, then bring its scenario back.
2. Build the locked and broken-key private balances (phase 1 below), which brings back the other 10.

## Shortcomings

- **Selectors.** The app had no `testID`s, so flows find things by visible text and by screen points: the terms switch, the Send tab (where it is depends on whether the Swap tab shows), the address field, the privacy card and its switches, a modal's backdrop. Points break on another screen size, another layout or a new tab; text breaks with copy and translations. The runner also taps the Send tab and the address field with adb at fixed pixels.
- **Debug build and Metro.** Runs use the debug app with its JS from Metro: slower, the first taps after a launch get dropped, LogBox toasts cover the tab bar, typing `R` twice reloads the app, and Metro opens a DevTools window each load. The kit also writes the app's network settings with `run-as`, which only a debuggable build allows.
- **One setup.** Only the privnet with the fullnode facade runs. The wallet-service facade has no local stack yet; the public testnets can't have their flags set (by rule) or their funds controlled; passkey setups need a ceremony the emulator can't do yet.
- **Unbuildable states.** A locked or broken-key private balance can't be set up yet, which skips 10 scenarios. Forcing a shielded-key mismatch, which both need, works only in a debug build, and runs now use the `e2e` build: these scenarios need a debug-build run, or a way to force the mismatch from outside the app.
- **Speed.** Each Maestro tap costs 1 to 3.5 s, mostly waiting for the screen to settle; the return to the dashboard takes about 10 s of back presses; every setup onboards a wallet from scratch.
- **Graph breadth.** The graph models 4 actions; the official QA covers about 30 to 40. A scenario can only be automated once its action is in the graph.
- **Clearing the address field.** The Send tab keeps the last address, and Maestro can't clear a multi-line field reliably, so the runner does it with adb (Ctrl+A, Delete).
- **Flakes.** Maestro's driver sometimes fails to start (retried once) or dies mid-flow (fails the scenario).
- **One machine.** Everything runs on one host, one emulator at a time.

## Roadmap

### Phase 1: a sturdier engine

- `testID`s for every element the flows touch, and flows that use them. Text stays for what a flow checks the user sees: the outcomes' messages. Done for the screens the current flows go through (README "Selectors").
- Runs on a release build with its JS in the APK: no Metro, no LogBox, no dev keys. Done: the `e2e` build type is the release build plus plain HTTP to a local node; the network settings are written as root on the emulator, not through `run-as`. It didn't make the scenarios faster: Maestro's waits dominate.
- A deep link, or the tab bar by id, to return to the dashboard.
- A failed scenario retried once on a fresh wallet, and flaky ones kept in a quarantine list.
- Setup for the locked and broken-key private balances.
- Faster taps: tune Maestro's wait for the screen to settle; a snapshot of the app after onboarding, so a setup costs seconds.

### Phase 2: the whole app on the privnet with the fullnode

Model the remaining actions in the graph, then automate them: creating, registering and unregistering tokens; receiving, private receives, unlocking and exporting the privacy keys; history; importing and resetting a wallet; settings, address mode, custom network; nano contracts (the privnet has them on). With small helpers: Reown (a WalletConnect client scripted in Node), biometry (`adb emu finger touch`), QR scanning (the emulator's virtual camera scene). Order to decide: by QA pain, by risk, or by reuse (create-token first, since other actions need tokens).

### Phase 3: the wallet-service facade locally

Run the wallet-service stack in Docker beside the privnet, which doubles the setups the kit can reach.

### Phase 4: CI

- **Shards.** A shard is one setup and a slice of its scenarios, with its own wallet and its own privnet: nothing is shared, so it scales close to linearly.
- **A merge job** collects the shards' results into one results file and one viewer.
- **Per PR**, the graph's impact tool picks the scenarios the change touches (typically 20 to 100: 5 to 10 min with shards). Nightly, everything.
- **Hosting the evidence**: a private bucket with signed links, or a tailnet machine that pulls the artifacts and serves them.

### Phase 5: reach

An iOS subset on macOS runners; a real-device farm for the timing checks on a low-end Android device; smoke runs on the public testnets with their flags as Unleash serves them and funds from a wallet we control.

### Likely to stay manual

Push notifications (real FCM), passkey ceremonies, app updates from the store, white-label builds, and judging the visual design.

## Estimates

The whole app is likely 600 to 1,200 scenarios; the graph will give the number once each action is modelled.

| 1,000 scenarios | Wall time |
|---|---|
| One emulator, today's speed | about 22 h |
| One emulator, after phase 1's speed work | about 10 to 12 h |
| 20 parallel runners | about 45 to 70 min |
| 50 parallel runners | about 25 to 35 min |
| A PR's picks with shards | about 5 to 10 min |

Cost of a full run, about 1,300 runner-minutes on Linux runners with KVM: free on GitHub's standard runners for a public repo, within the plan's limit of concurrent jobs; roughly $10 to $25 on larger or private-repo runners. iOS on macOS runners costs about 10 times more a minute, so a subset. A 16-core machine of our own runs about 4 emulators: a full run overnight in 4 to 6 h. Video is about 10 GB a full run at today's bitrate; half the resolution, or only failed and sampled scenarios, brings it to a few GB. These are estimates to check against current pricing and the org's plan.

The larger cost is people's time: modelling each action in the graph and writing its flow, about half a day to a day each with the infrastructure in place, so several weeks for the whole app. The viewer keeps that trustworthy: watch the suite once, then only what changed.

## Decisions to make

1. Runners: GitHub's free public-repo runners, a machine of our own, or both (ours nightly, the cloud for PRs and releases).
2. `testID`s land in the app's code in the official repo, which bears on RFC 0004 (HathorNetwork/rfcs PR 110) and where the kit lives.
3. Where the evidence is hosted.
4. The order of phase 2.
