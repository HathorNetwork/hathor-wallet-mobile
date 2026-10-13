# Shielded Outputs

Shielded outputs hide the amount (amount-shielded) or the amount and the token (fully shielded) of a transaction output. The wallet decodes the ones paid to it with its shielded scan key and a native crypto provider (`@hathor/ct-crypto-mobile`).

Run these tests on iOS and Android release builds. The shielded UI stays behind the `shielded-outputs.rollout` flag, which defaults to off. Unleash turns it on for the `testnet-shielded-outputs` network only. On the Shielded Testnet, the wallet decodes private outputs whether or not the flag is on.

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
1. With the flag on, open HTR. Under "Available Balance", the private part (a shield, "X private") and the public part (an eye, "Y public") add up to it. A tap on the balance expands nothing: the screen has no Locked balance.
1. Receive a private output: the private part grows without a reload.
1. Start a send of public funds and check that the parts still add up while it is pending and once it is confirmed.
1. With the token screen open, turn the flag off, then on: the parts disappear, then show again.
1. Open a custom token that holds funds on the Shielded Testnet. With its screen open, change the network in Settings to Testnet, then back to the Shielded Testnet. Once the wallet loads, the token's balance is right on its screen and on the Dashboard, and its parts add up to it.
1. With the flag off, the screen shows the available balance alone, which the private funds still count in, with no Locked balance to expand. Mainnet and Testnet show it the same way.

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

### The tx details and their fees
1. On any network, open a tx's details. Under the amount, they say what the tx did with the token, as "Sent HTR", "Received HTR" or "You sent HTR to yourself", and list Date & Time, Transaction ID and Public Explorer. There are no Token, Description or Fee Model rows, and a nano contract tx has no nano contract rows.
1. With the flag on, have a dApp connected through Reown send with `htr_sendTransaction` an amount the public funds can't cover, so the send spends private funds. Its private change shows in the balance without a reload.
1. Open that send's details: Fees shows between Date & Time and Transaction ID. Tap it: it expands into Network fee and Privacy fee, which add up to the explorer's fee for the tx.
1. Open a received tx with shielded outputs: Fees shows the fees its sender paid.
1. Open a send of a fee-based token: Fees shows its network fee.
1. With the private balance locked, Fees still shows. With the flag off, and on Mainnet and Testnet, there's no Fees row.

### Single-address mode on the Shielded Testnet
1. With the single-address flag on and Single Address chosen on the Testnet, switch to the Shielded Testnet. The wallet starts in multi-address mode.
1. Open Settings -> Address Mode: Single Address is disabled, with "Single address mode is not available on this network."
1. Switch back to the Testnet: the wallet starts in single-address mode, as chosen.

### More timings on a low-end Android device
On the Shielded Testnet, record the time from the PIN entry of "Unlock private balance" to the private part of the balance, and the time a token screen with many private UTXOs takes to show its parts.

### Private sends
With the flag on, on the Shielded Testnet, with public and private HTR and a registered custom token. Copy a private address from another wallet's Receive screen, on Private.
1. Send HTR to a public address. The amount screen shows the privacy mode above Next, in Public. Tap it: the "Transaction privacy" sheet says "Choose what's hidden only for this transaction", with "only for this transaction" in bold, and offers Private ("Token and amount hidden", "Fee: 0.02 HTR per output"), Hide amount ("Token visible, amount hidden", "Fee: 0.01 HTR per output") and Public ("Token and amount visible", "No privacy fees"). Under them it says "You can change your default on advanced settings", above DONE.
1. Pick Hide amount, tap DONE, type an amount and tap Next: the screen says "The selected privacy mode requires a shielded address as the recipient. The address you entered is not shielded — change the address or switch to Public." Pick Public and tap Next: the send goes on.
1. Send HTR to the private address in Public, the mode the amount screen starts in. The send is built and sent: the recipient gets a public output, paid to the P2PKH address of the private address's spend key.
1. Send an amount with change to the private address in Hide amount. The confirmation shows "Transaction summary" over the card, To with the address and no badge, no privacy mode, and Fees with their total. Tap Fees: it expands into Network fee, if any, and "Privacy fee (N outputs)". The info icon opens "Transaction fees". The total, in bold, is the amount plus the fees.
1. Send it. The recipient wallet receives it, and this wallet's balance shows the private change at once, without a reload.
1. Repeat in Private, with the custom token: each fully shielded output costs 0.02 HTR.
1. Send the whole private balance of the custom token, then a 1-unit amount of an NFT, then an amount of a fee-based token: each is built and sent, and the fee-based token's network fee shows in the breakdown.
1. Send in Private an HTR amount that leaves less HTR than the privacy fees need: the send isn't built, and the screen says "Insufficient HTR to cover this transaction and its fees." When the HTR change can't pay its own privacy fee, it says "Insufficient HTR to cover the privacy fees of this transaction." instead, and never suggests keeping the change public.
1. Send to a public address an amount the public HTR can't cover, so the send spends private HTR. The confirmation shows Fees with a privacy fee for the private change, and after the send the private change is in the balance at once.
1. Compare the fees of a few sends with the fees the explorer shows for them: the totals match.
1. With a fee-based token of more than 2^40 base units (no deposit needed), type a private amount of 10,995,116,277.76 or more: the screen says "A private send can be at most 10,995,116,277.75" and the token's symbol, and doesn't go on. The same amount in public goes on.

### A private send while the private balance is locked
This needs a start with a PIN that doesn't decrypt the scan key, as in "A start that leaves the private funds locked" above.
1. Start a send of HTR. Under the available balance, which lacks the locked private funds, the amount screen counts them ("2 private outputs are locked") and offers "Unlock private balance". Type more than the available balance and tap Next: it says "Insufficient funds", and still offers the unlock.
1. Tap "Unlock private balance" and enter the PIN: a spinner shows until the private funds are decoded, then the available balance includes them, and the count and the unlock are gone. Start the wallet locked again, as above, for the next steps.
1. Start a send to a private address, and pick Hide amount in the privacy sheet. The confirmation says "Your private balance is locked. Unlock it to send privately." and offers "Unlock private balance".
1. Tap it and cancel the PIN screen: the request shows again.
1. Tap it and enter the PIN, then with safe biometry on: "Reading your private balance" shows until the wallet decoded its private outputs, then the send is built. Send it.
1. A public send to a public address while locked is built at once, with no unlock.

### Private addresses where private sends aren't available
1. With the flag off on the Shielded Testnet, on Mainnet, on Testnet, and on the wallet-service facade, type and scan a private address of the network: Next stays disabled.
1. With the flag on, in a debug build, make the provider's self-test fail, as in "When private receiving is unavailable", then type and scan a private address: the input takes it, the amount screen shows no privacy mode, and the send is public, paid to the address of the private address's spend key.
1. With the flag on, after an unlock that found the wallet's shielded keys don't match, as in "Unlocking a locked private balance", send to a private address: it is taken and sent in public the same way.
1. With the flag on, type a private address whose checksum is right but whose key isn't a point of the curve: Next stays disabled.
1. On Mainnet and Testnet, send to a public address: there is no privacy mode, and the confirmation shows no privacy fee.
1. With the flag off on the Shielded Testnet, send to a public address an amount the public HTR can't cover, so the send spends private HTR: the confirmation's Fees row expands into Network fee alone, the whole fee, with no privacy fee line.

### Reown sends that spend private funds
1. With the flag on, have a connected dApp send with `htr_sendTransaction`, with its own legacy `changeAddress`, an HTR amount the public funds can't cover. The request error modal says "This transaction spends private funds, so its change must stay private, but the dApp asked to send the change to an address that can't receive private funds.", See why shows wallet-lib's message, and the dApp gets "Transaction failed validation".
1. Repeat without a `changeAddress`: the send goes through, and its private change shows in the balance.

### dApps and the new address
1. With the flag on, connect a dApp through Reown: the session's account is `hathor:testnet:` and the wallet's new address at index 0.
1. Have the dApp send with `htr_sendTransaction` to a private address: the request reaches the confirmation and is sent, as a public output to the address of the private address's spend key.
1. Repeat with the flag off, and on Testnet: the request error modal says "This wallet does not support shielded addresses." and the dApp gets an error. The session's account is the legacy address at index 0.
1. With the flag on, open a nano contract request, and register a nano contract: the caller they start from is the wallet's legacy address at index 0, as on Testnet, and the address list offers legacy addresses only. Send the request: it goes through.
1. In a debug build, make the provider's self-test fail, then connect a dApp: the request error modal says "Private transfers could not be loaded on this device.", and the dApp's proposal is rejected. Registering a nano contract still works, with the legacy address.

### Token creation and swaps
1. With the flag on, create a token: the confirmation has no warning about private HTR, and the token is minted to the wallet's current new address. The new tokens show in the balance.
1. With the flag off, the token is minted to a legacy address, as before.
1. With the private balance locked, as in "A start that leaves the private funds locked", create a token: the creation fails with "Your private balance is locked. Unlock it and try again." Unlock it from the token screen and create it again: it is created.
1. With the flag on, swap tokens: the swap, a nano contract call, uses the wallet's legacy address at index 0, as on Testnet, and goes through.

### Timings of private sends on a low-end Android device
On the Shielded Testnet, record the time from Next on the amount screen to the confirmation's summary, for a Hide amount send and for a Private send of a custom token, and compare it with a public send.
