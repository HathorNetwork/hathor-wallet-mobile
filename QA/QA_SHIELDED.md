# Shielded Outputs

Shielded outputs hide the amount (amount-shielded) or the amount and the token (fully shielded) of a transaction output. The wallet decodes the ones paid to it with its shielded scan key and a native crypto provider (`@hathor/ct-crypto-mobile`).

Run these tests on iOS and Android release builds. The shielded UI stays behind the `shielded-outputs-mobile.rollout` flag, which defaults to off. On the Shielded Testnet, the wallet decodes private outputs whether or not the flag is on.

### Before you start
1. Set up a wallet that can send shielded outputs on the Shielded Testnet, for example a wallet-lib script with `@hathor/ct-crypto-node`, and fund it from the faucet.
1. With the flag on, Receive shows the wallet's new (shielded) address. With the flag off, the app shows none: to pay the mobile wallet privately, restore its seed in a wallet-lib script with a crypto provider and read its shielded address, for example with `getCurrentAddress({}, { legacy: false })`.
1. On Unleash, the flag targets the network the wallet reports as `network`: `testnet` for the Testnet preset and `testnet-shielded-outputs` for the Shielded Testnet preset. Enable it for both to see the preset from the Testnet.
1. Read the app's logs: on iOS with `log stream --predicate 'process == "HathorMobile"'` on the simulator, or Console.app for a device; on Android with `adb logcat ReactNativeJS:V`. Release builds on iOS only log errors.

### Mainnet and Testnet are unchanged
1. With the flag off, unlock a wallet on Mainnet, then on Testnet.
1. Check the logs: there's no `[shielded-provider]` line.
1. The loading screen finds the same addresses, in the same time, as a build on wallet-lib 3.1.1 with the same seed: no shielded address is derived or subscribed.
1. Repeat with the flag on.

### The Shielded Testnet preset
1. With the flag off, go to Settings -> Developer Settings -> Network Settings and accept the risk disclaimer. Only Mainnet and Testnet are offered.
1. Turn the flag on and reopen the screen. A third card, Shielded Testnet, shows `https://node1.shielded-outputs.testnet.hathor.network/v1a/`.
1. Tap it. The wallet reloads on the shielded testnet and the success modal shows.
1. Change network to Testnet and back to the Shielded Testnet: both reloads succeed.
1. Customize a network with the Shielded Testnet's node URL and a wallet-service URL: the wallet still starts on the fullnode facade.

### The crypto provider
1. On the Shielded Testnet, unlock the wallet. The logs show no `[shielded-provider]` error: the provider passed its self-test.
1. In a debug build, the redux state shows `shielded.providerStatus` as `ready` and `shielded.capability.level` as `full`.
1. Turn the flag off and restart the app: the provider is still registered.
1. If the self-test fails, the logs show `[shielded-provider] The shielded crypto provider is not available`, nothing is shown on screen, and the wallet works with its public funds only. A retry happens at the next start.

### Private funds count in the balance
1. On the Shielded Testnet, note the HTR balance.
1. From the sending wallet, pay an amount-shielded HTR output to the wallet's shielded address. The HTR balance grows by that amount without a reload.
1. Pay a fully shielded HTR output: the balance grows again.
1. Pay a shielded output of a custom token the wallet has registered: that token's balance grows.
1. Turn the network off and on (airplane mode): after the reconnect, the balance is the same.
1. Change the PIN, then lock and unlock the app: the balance is the same.
1. Kill and reopen the app: the balance is the same.
1. With the flag off, repeat a private receive: the balance grows the same way.

### A start that leaves the private funds locked, then the lock-screen unlock
A start whose PIN doesn't decrypt the shielded scan key doesn't fail: the wallet starts with its private funds locked. A reload uses the PIN of the last PIN change, so this needs a debug build to reach.
1. In a debug build, make `startWallet` pass a wrong `pinCode` to `wallet.start()` once, and start the wallet on the Shielded Testnet with private funds received.
1. The wallet starts. Its HTR balance lacks the private funds, the redux state shows `shielded.capability.level` as `watch`, and the logs say the shielded view key was not unlocked at start.
1. Send the app to the background for more than 30 seconds and unlock it with the PIN.
1. The private funds return to the balance without a reload, and the level is `full`.
1. Repeat with safe biometry on: the unlock with biometry gives the same result.

### One wallet after a reload
1. With the single-address flag on, on Mainnet, watch the app's websocket connections to the node with a proxy (for example mitmproxy).
1. Switch the Address Mode in Settings. The wallet reloads, the old websocket closes, and one stays open.
1. Check that the balance, the history and the Receive screen are right after the reload.
1. Repeat on the Shielded Testnet, which has no single-address mode: reload the wallet with a network change to Testnet and back instead. After each reload, the old websocket closes and one stays open.

### Reload, stop and failed start
1. Address Mode switch: covered above.
1. Network change: switch between Mainnet, Testnet and the Shielded Testnet. Each reload finishes with the right balances.
1. Wallet-service disable: with the wallet on the wallet-service facade (Mainnet or Testnet), turn the wallet-service flag off. The wallet reloads on the fullnode facade.
1. PIN change, then reload: change the PIN, then switch the Address Mode. The wallet reloads without an error. On the Shielded Testnet, which has no single-address mode, change the network to Testnet and back instead: the private funds stay in the balance.
1. Failed start: turn the network off, kill the app, open it and unlock. The start fails and shows the error screen. Turn the network on and retry: the wallet loads, and only one websocket is open.

### Timings on a low-end Android device
On the Shielded Testnet, with a wallet that has received several private outputs, record:
1. the time from the PIN entry to the dashboard, on a cold start;
1. the time of a reconnect, from airplane mode off to the balance;
1. the time of a lock-screen unlock of a wallet whose private funds were locked.

Compare them with the same wallet on Testnet.

### The new address on Receive
With the flag on, on the Shielded Testnet:
1. Open Receive. It shows the wallet's new address alone, with its QR code, copy, New address and Share. There's no Public/Private toggle, and the legacy address never shows.
1. Share sends "Here is my address: " and the address.
1. Tap New address: the address and its QR code change to the next new address.
1. In a debug build, the redux state's `lastSharedAddress` is the address Receive shows.
1. From the sending wallet, pay an amount-shielded output to that address: the balance, the history and Receive update without a reload. Repeat with a fully shielded output, then with a shielded output of a custom token the wallet has registered.
1. Turn the network off and on, then kill and reopen the app: the private funds are still in the balance.
1. With Receive open, turn the flag off: Receive shows the legacy address, with its New address, as before, and `lastSharedAddress` is that address. Turn the flag on again: the new address shows again.

### The private part of the balance
1. With the flag on, open HTR. Under "Available Balance", the private part (a shield) and the public part (an eye) add up to it. Tap to expand: Locked shows as before, with the parts under "Available Balance".
1. Receive a private output: the private part grows without a reload.
1. Start a send of public funds and check that the parts still add up while it is pending and once it is confirmed.
1. With the token screen open, turn the flag off, then on: the parts disappear, then show again.
1. Open a custom token that holds funds on the Shielded Testnet. With its screen open, change the network in Settings to Testnet, then back to the Shielded Testnet. Once the wallet loads, the token's balance is right on its screen and on the Dashboard, and its parts add up to it.
1. With the flag off, the screen is as before, and the private funds still count in the available balance.

### Unlocking a locked private balance
This needs a start with a PIN that doesn't decrypt the scan key, as in "A start that leaves the private funds locked" above.
1. The token screen counts the locked private outputs ("2 private outputs are locked") and offers "Unlock private balance". Receive says "Private receiving is locked" and offers the same action.
1. Tap it and cancel the PIN screen: nothing changes.
1. Tap it and enter the PIN: a spinner shows until the private funds are decoded, then the parts of the balance show them, and Receive shows the new address.
1. Repeat from Receive, and with safe biometry on.
1. In a debug build, make `wallet.unlockShieldedView` throw a `ShieldedKeyError` with the code `shielded-wrong-pin`: the action says "Could not unlock your private balance." and offers the unlock again.
1. In a debug build, make wallet-lib's `unlockScanKeyWithPin` throw a `ShieldedKeyError` with the code `shielded-key-mismatch`, then unlock from the token screen. The level drops to `none`: the token screen keeps the count of locked private outputs, says "Private transfers are not available for this wallet." and "Could not unlock your private balance.", and offers no unlock. Receive says "Private receiving is unavailable".

### When private receiving is unavailable
1. In a debug build, make the provider's self-test fail. Receive says "Private receiving is unavailable" and "Private transfers could not be loaded on this device.", never the legacy address, and the token screen shows no private part.
1. In a debug build, make `getPrivateAvailableBalance` throw: the balance still loads, without the parts, and the logs show `[tokens-saga] Failed to read the private part of the token balance.` once.
1. In a debug build, make `wallet.getCurrentAddress({}, { legacy: false })` throw an unexpected error while a global you can clear from the debugger is set. Receive says "Private receiving is unavailable" and "Could not load your private address.", and offers Retry, and `lastSharedAddress` is null. Tap Retry: it fails the same way. Clear the global and tap Retry: the new address shows.

### Private funds that couldn't be read
1. In a debug build, make a decode fail with an error a retry can fix (counted in the capability's `undecoded.error`). The token screen says "Some private funds could not be read." and offers Retry.
1. Tap Retry: a spinner shows while the history is processed again, then the funds show in the balance.

### Fees in the tx details
1. With the flag on, have a dApp connected through Reown send with `htr_sendTransaction` an amount the public funds can't cover, so the send spends private funds. Its private change shows in the balance without a reload.
1. Open that send's details: Fees shows between Fee Model and Transaction ID. Tap it: it expands into Network fee and Privacy fee, which add up to the explorer's fee for the tx.
1. Open a send of a fee-based token: Fees shows its network fee.
1. Open a received tx: there's no Fees row.
1. With the private balance locked, or the flag off, there's no Fees row.

### Single-address mode on the Shielded Testnet
1. With the single-address flag on and Single Address chosen on the Testnet, switch to the Shielded Testnet. The wallet starts in multi-address mode.
1. Open Settings -> Address Mode: Single Address is disabled, with "Single address mode is not available on this network."
1. Switch back to the Testnet: the wallet starts in single-address mode, as chosen.

### More timings on a low-end Android device
On the Shielded Testnet, record the time from the PIN entry of "Unlock private balance" to the private part of the balance, and the time a token screen with many private UTXOs takes to show its parts.
