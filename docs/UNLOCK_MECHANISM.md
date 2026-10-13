# Unlock Mechanism

This document describes what happens with the app and the lib during the wallet start mechanism after an unlock

1. App is opened
1. Default screen, as defined on the `AppStack` on `src/App.js` is `PinScreen`, so the Pin is requested from the user
1. With the PIN, the words are retrieved and stored on the `initWallet` redux store item using the `setIinitWallet` action
1. The app navigates to `LoadHistoryScreen`, which retrieves the words from the redux from the previous step and dispatches `startWalletRequested`
1. `startWallet` saga is called and decides whether to load using the wallet-service facade or the old facade. 
1. A `Connection` instance is created, passing the network and the server (on the wallet service, the Connection object is created by the HathorWalletServiceWallet instance)
	1. `this.websocket` is instantiated with `WalletWebSocket` (which extends `BaseWebSocket`)
1. `HathorWallet` is instantiated, receiving this `connection` instance
1. The history sync mode is set to `POLLING_HTTP_API`, wallet-lib's default and the only mode that watches the addresses shielded outputs are paid to
1. On the shielded testnet (the selected network's `fullNetwork` is `testnet-shielded-outputs`), a seed wallet gets the shielded crypto provider of `@hathor/ct-crypto-mobile` (`registerShieldedCryptoProvider` in `src/sagas/shieldedProvider.js`), whether or not the `shielded-outputs.rollout` flag is on:
	1. `loadShieldedCryptoProvider` creates the provider and self-tests it: deriving the tag of HTR must give HTR's known tag within 10 s. The provider that passes is kept for the next starts
	1. `wallet.setShieldedCryptoProvider` registers it, and `state.shielded.providerStatus` becomes `ready`
	1. On a failure, `providerStatus` becomes `failed` with the message in `providerError`, the error is logged, and the wallet starts transparent-only. Nothing is shown to the user
	1. No provider is registered on other networks, on the wallet-service facade or for passkey wallets. Without one, wallet-lib does no shielded address work. `isWalletServiceEnabled` keeps the shielded testnet on the fullnode facade
1. Listeners are setup on the `HathorWallet` instance and directly into the `conn` instance of it:
	1. [`conn`]: `best-block-update` → `bestBlockUpdate`
	1. [`conn`]: `wallet-load-partial-update` → `loadPartialUpdate`
	1. [`conn`]: `state` → `onWalletConnStateUpdate`
	1. `reload-data` → `onWalletReloadData`
	1. `new-tx` → `handleTx`
	1. `update-tx` → `updateTx`
	1. `shielded-capability` → `SHIELDED_CAPABILITY_UPDATE`, stored in `state.shielded.capability`. `start()` emits it once, and the wallet emits it again on every change
1. `HathorWallet` instance `start` method is called
	1. With the PIN it is given, it decrypts the shielded scan key and holds it in memory until `stop()`. A PIN that doesn't decrypt the key doesn't fail the start: the wallet's shielded outputs stay locked (capability level `watch`) until the next PIN entry unlocks them (see below)
	1. Listeners are setup on the `Connection` instance that was passed as an option
		1. `state` → `onConnectionChangedState`
		1. `wallet-update` → `handleWebsocketMsg`
	1. Version from the full node is verified and if successful, the `start` method is called on the `Connection` instance
		1. Listeners are setup on the `websocket` instance that was instantiated on step 6.1
		1. State is set to `ConnectionState.CONNECTING`, this is received on the `onConnectionChangedState` in the `HathorWallet` instance
		1. `this.websocket` instance `setup` method is called
			1. It verifies if `this.started` is `false`, which it is, as it was recently instantiated and we set it to `false` [hathor-wallet-lib/base.ts at 9a5a7666444a6c1de2b246b26f73dc887e658b4c · HathorNetwork/hathor-wallet-lib · GitHub](https://github.com/HathorNetwork/hathor-wallet-lib/blob/9a5a7666444a6c1de2b246b26f73dc887e658b4c/src/websocket/base.ts#L88)
			1. It verifies that `this.ws` exists, which it shouldn't have, as this instance have just been initialized, if it does for some reason, it will cleanup the `onclose` listener and set `this.ws` to `null`
			1. It instantiates a new WebSocket instance and sets it to `this.ws` 
			1. It setups the listeners (`onOpen`, `onMessage`, `onError`, `onClose`)
1. The saga waits until the `HathorWallet` state transitions to `Ready`
1. The saga reads `getShieldedCapability()` and stores it in `state.shielded.capability`
1. The `loadTokens` saga is started, to download balances for all the tokens the wallet ever interacted with and `HTR` and `DEFAULT_TOKEN` balance and history
1. `startWalletSuccess` action is dispatched, causing `App.js` to render the Home Screen.

## A reload or a failed start

1. A reload (`RELOAD_WALLET_REQUESTED`, for example after an Address Mode switch) stops the running `HathorWallet` with `stop({ cleanStorage: false })`, then dispatches the start action again. A network change has already stopped it, so it isn't stopped twice
1. A failed start (`START_WALLET_FAILED`) removes the wallet's listeners and stops it the same way before it drops the wallet from redux
1. Each start builds its own storage, so the stopped wallet keeps its data, and its stop ends only its own shielded session

## Unlocking a running wallet at the lock screen

1. The app locks after `LOCK_TIMEOUT` in the background, and `PinScreen` shows as the lock screen
1. Once the PIN is entered (or read from the keychain with biometry), `dismiss` runs the data migration and the biometry migration, which returns the PIN or password that decrypts the access data now (`actualPin`)
1. With no wallet in redux (a cold start), it dispatches `startWalletRequested({ words, pin: actualPin })`, and `start()` unlocks the scan key
1. With a running wallet:
	1. If the biometry migration re-encrypted the access data, it dispatches `walletPinChanged(actualPin)`, so a reload starts the wallet with it
	1. It dispatches `shieldedViewUnlockRequested({ pinCode: actualPin, source: 'lock-screen' })`. No reducer handles it, so the PIN never enters the redux state
1. The shielded saga (`src/sagas/shielded.js`) handles the request only where the provider passed its self-test (`providerStatus` is `ready`):
	1. `unlockShieldedViewIfLocked` reads `getShieldedCapability()`; only at level `watch` does it call `wallet.unlockShieldedView({ pinCode })`, and not when the cause is `corrupt-key`: the PIN passes the check of the stored scan key, but the key doesn't decrypt to a valid one, so no PIN can unlock it
	1. The returned capability is stored, and a detached task waits for `reprocessed`, the end of the walk that decodes the locked outputs, then refreshes the balances
	1. A `ShieldedKeyError` (for example `shielded-wrong-pin`) is logged with its code, never with the PIN, and nothing is shown to the user
1. Whenever `state.shielded.capability` changes in a way that can change the balances (its level, cause or history completeness, or fewer locked or failed outputs), the shielded saga waits 300 ms for the changes to settle, then fetches the balances of the registered tokens again, but only while the wallet is ready

## Unlocking a locked private balance

1. Where the shielded UI shows private funds that are locked, `ShieldedUnlockAction` offers "Unlock private balance". It opens `PinScreen` with `canCancel`
1. The PIN screen's callback dispatches `shieldedViewUnlockRequested({ pinCode, source: 'user' })`, with the PIN, or the password safe biometry reads from the keychain. The PIN never goes to the navigation params or the redux state
1. The shielded saga handles it as it handles the lock screen's request, and reports its progress in `state.shielded.unlock`:
	1. `unlocking` while it unlocks the scan key
	1. `decoding` until the walk that decodes the locked outputs ends and the balances are fetched again
	1. then `idle`; or `failed`, with the `ShieldedKeyError`'s code in `errorCode` when wallet-lib refused. An error nothing expects also opens the error modal
1. A later PIN entry, at the lock screen for example, replaces a running unlock, which goes back to `idle`
1. `ShieldedUnlockAction` shows a spinner while the status is `unlocking` or `decoding`, and says when the unlock failed
1. An unlock that finds the wallet's scan key doesn't match its shielded xpub fails with `shielded-key-mismatch`, and wallet-lib stops using the record's shielded keys: the level drops to `none`, reason `integrity`, and no PIN fixes it. The token screen then shows no unlock: it says that private transfers aren't available for this wallet, with the locked count and the failure
1. The send amount screen (`SendAmountInput`) checks the amount against the available balance, which leaves out the private outputs the wallet holds locked. Where private sends are available and a PIN can unlock them, it shows how many there are and `ShieldedUnlockAction`, as the token screen does, so that a send that needs them can unlock them first

## Unlocking before a private send

1. A private send needs the wallet at level `full`. Where a PIN can unlock a locked wallet (level `watch`, any cause but `corrupt-key`), the send confirmation (`SendConfirmScreen`) asks to unlock it instead of building the send
1. "Unlock private balance" opens `PinScreen` (`canCancel`). Its callback calls the same helper as the lock screen and Receive, `unlockShieldedViewIfLocked(wallet, pinCode)`, directly from the screen, which must wait for the end of the walk before it builds: the shielded saga isn't involved
1. On `unlocked`, the screen waits for `reprocessed`, then builds the send once the wallet is ready, at level `full`. On `failed`, it says "Could not unlock your private balance." The capability event of the unlock and of the walk's end updates `state.shielded.capability` and refreshes the balances, as for any other unlock
1. The PIN goes from the PIN screen's callback to wallet-lib only: no action carries it, and the send keeps no PIN

## Retrying private funds that couldn't be read

1. Private outputs whose decode failed in a way a retry may fix are counted in the capability's `undecoded.error`. A retry dispatches `shieldedReprocessRequested()`
1. The shielded saga calls `wallet.reprocessShieldedOutputs()`, which processes the whole history again in a walk, then fetches the balances again. Its progress is `decoding` until the walk ends, then `idle`
1. A wallet that is connecting or stopped refuses with `shielded-not-ready` or `shielded-not-started`. The walk of its next connection retries the outputs, so the refusal is only logged

## Exporting the privacy keys

1. The export (`ExportPrivacyKeys`, from Settings, under Privacy) shows its warning first. Its action shows only where `state.shielded.capability` is at level `view` or `full`. At level `watch` with a cause a PIN can fix, it offers `ShieldedUnlockAction` instead, and the export once the wallet is unlocked
1. The action opens `PinScreen` (`canCancel`) with no PIN or key in the params. Its callback gets the PIN, or the password safe biometry reads from the keychain
1. If the shielded UI stops being available meanwhile, `PinScreen` closes with the export and the privacy settings under it (`closeScreen`), and the callback never runs
1. The callback reads `wallet.getShieldedCapability()` again, and stops unless the level is `view` or `full`: the wallet checked its scan key against its shielded xpub when it unlocked it. Then it reads `storage.getSpendXPubKey()` and `storage.getScanXPrivKey(pinCode)`, which decrypts the scan key with the PIN
1. A PIN change, turning safe biometry on or off, and the biometry migration all go through `storage.changePin`, which re-encrypts the scan key with the rest of the access data, so the password the callback gets decrypts it
1. The PIN goes from the callback to wallet-lib only, and the keys stay in the screen's state: no action, log or navigation param carries either
