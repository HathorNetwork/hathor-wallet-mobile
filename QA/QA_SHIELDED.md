# Shielded Outputs

Shielded outputs hide the amount (amount-shielded) or the amount and the token (fully shielded) of a transaction output. The wallet decodes the ones paid to it with its shielded scan key and a native crypto provider (`@hathor/ct-crypto-mobile`).

Run these tests on iOS and Android release builds. The shielded UI stays behind the `shielded-outputs.rollout` flag, which defaults to off. Unleash turns it on for the `testnet-shielded-outputs` network only. On the Shielded Testnet, the wallet decodes private outputs whether or not the flag is on.

### Before you start
1. Set up a wallet that can send shielded outputs on the Shielded Testnet, for example a wallet-lib script with `@hathor/ct-crypto-node`, and fund it from the faucet.
1. This app shows no shielded address yet. To pay the mobile wallet privately, restore its seed in a wallet-lib script with a crypto provider and read its shielded address, for example with `getCurrentAddress({}, { legacy: false })`.
1. On Unleash, the flag targets the network the wallet reports as `network`: `testnet-shielded-outputs` for the Shielded Testnet. With the flag on only there, the Shielded Testnet preset doesn't show on Mainnet or Testnet. Reach the Shielded Testnet through a custom network with `https://node1.shielded-outputs.testnet.hathor.network/v1a/`, whose node reports `testnet-shielded-outputs`. To check the preset itself, also turn the flag on for your device on Testnet.
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
1. Repeat on the Shielded Testnet.

### Reload, stop and failed start
1. Address Mode switch: covered above.
1. Network change: switch between Mainnet, Testnet and the Shielded Testnet. Each reload finishes with the right balances.
1. Wallet-service disable: with the wallet on the wallet-service facade (Mainnet or Testnet), turn the wallet-service flag off. The wallet reloads on the fullnode facade.
1. PIN change, then reload: change the PIN, then switch the Address Mode. The wallet reloads without an error.
1. Failed start: turn the network off, kill the app, open it and unlock. The start fails and shows the error screen. Turn the network on and retry: the wallet loads, and only one websocket is open.

### Timings on a low-end Android device
On the Shielded Testnet, with a wallet that has received several private outputs, record:
1. the time from the PIN entry to the dashboard, on a cold start;
1. the time of a reconnect, from airplane mode off to the balance;
1. the time of a lock-screen unlock of a wallet whose private funds were locked.

Compare them with the same wallet on Testnet.
