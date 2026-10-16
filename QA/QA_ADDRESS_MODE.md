# Address Mode

This is the standard, every new wallet should initialize in single address mode.

### Auto switch to multi with tx outside index 0

1. Generate a new wallet (or import an empty one)
1. Go to Settings -> Address mode, the single mode should be selected.
1. Select multi address mode and save. The wallet should restart.
1. Go to Receive screen -> Generate a new address, copy and save it somewhere. We'll need it
1. Back again to single address and save. The wallet should restart. We should be able to change the mode as we want while any transaction doesn't arrive in another address different than the index 0.
1. Send a transaction to your copied address (other than index 0)
1. Restart the wallet
1. Go to settings -> Address Mode. The single address options should be disabled with a warning mentioning that you have transactions in another addresses.

### Address mode per network

1. The wallet should be now in Multi, check it
1. Go to settings -> Change network -> testnet/mainnet (should be a different network than the one that you did the steps above)
1. Wait for the wallet restart, then go to Settings -> Address Mode, Single should be selected (and the standard for an empty wallet)

For the next steps you'll need a wallet connected to Reown, follow the [Reown QA](QA_REOWN.md) to do it.

### Single Address mode

1. Generate a new wallet (or import an empty one)
1. Go to Settings -> Address mode. The single address should be selected.
1. Go to Receive Screen, the "New Address" button should be hidden
1. Call a reown send transaction method, the caller edit option should be disabled

### Multi address mode

1. Generate a new wallet (or import an empty one)
1. Go to Settings -> Address mode. Change to multi.
1. Go to Receive Screen, the "New Address" button should be visible.
1. Go to Register nano contract screen -> the blue label saying that you can change the wallet address should be visible
1. Call a reown send transaction method, the caller edit option should be enabled
