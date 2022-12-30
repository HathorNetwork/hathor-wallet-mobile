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
1. Listeners are setup on the `HathorWallet` instance and directly into the `conn` instance of it:
	1. [`conn`]: `best-block-update` → `bestBlockUpdate`
	1. [`conn`]: `wallet-load-partial-update` → `loadPartialUpdate`
	1. [`conn`]: `state` → `onWalletConnStateUpdate`
	1. `reload-data` → `onWalletReloadData`
	1. `new-tx` → `handleTx`
	1. `update-tx` → `updateTx`
1. `HathorWallet` instance `start` method is called
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
1. The `loadTokens` saga is started, to download balances for all the tokens the wallet ever interacted with and `HTR` and `DEFAULT_TOKEN` balance and history
1. `startWalletSuccess` action is dispatched, causing `App.js` to render the Home Screen.

