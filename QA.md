# Suggested Test Sequence

1. **App update**
    1. Load the last release of the app and start a wallet. You can confirm the version on Settings -> About.
    1. Update the code to run the latest version, without resetting the wallet.
    1. You should be shown the PIN screen. Unlock the wallet and confirm load succeeded.
    1. Reset the wallet.

1. **Simple Initialization**
    1. Initialize a new wallet (save your words, they will be used later).
    1. When creating a PIN, type the wrong PIN during the confirmation step.

1. **Generate token error Tests**
    1. Go to Settings and Create a new Token.
    1. Enter token name Test Token, and click Next.
    1. Enter token symbol TEST, and click Next.
    1. Enter the amount of 100.
    1. The Next button should not be clickable. Also, deposit value and your balance should turn red.

1. **Receive Tests**
    1. Go to the Receive Screen and check the QR Code.
    1. Click on the address to copy it.
    1. Click on New address and check that a new address was generated. The QRCode must update.
    1. Click on Share and Cancel.
    1. Click on Payment Request and generate a payment request of 10 HTR.
    1. Pay the Payment Request using another wallet and check the confirmation message.

1. **Send Tests**
    1. Go to the Send Screen and check whether the camera loads correctly.
    1. Click on Manual Info.
    1. Type any random text and click Next. It must show an error message.
    1. Enter the address WZ7pDnkPnxbs14GHdUFivFzPbzitwNtvZo and click Next.
    1. Click on the HTR to change the token. Then, select HTR.
    1. Type 100 HTR, click Next, and check the insufficient funds error.
    1. Type 2 HTR, click Next, and check the send summary.
    1. Click on Send and type a wrong PIN Code.
    1. Finally, type a correct PIN Code and check the confirmation.

1. **Transaction History Tests**
    1. Open HTR History. Your balance should be 8.00 HTR.
    1. Check that you have two transactions.
    1. Click on any transaction and check the details.

1. **Settings Tests**
    1. Go to the Settings Screen. Check that you are connected to our `testnet`.
    1. Test Security > Lock Wallet.
        1. Enable TouchID (iOS only).
        1. Lock wallet and use TouchID (iOS only).
        1. Disable TouchID (iOS only).
        1. Lock wallet and it must require you to type your PIN Code.
    1. Test Security > Change PIN.
        1. Close and open the app and check wether the wallet unlocks correctly.
    1. Open About and go back.
    1. Click on Register a Token and check whether the camera loads correctly.
    1. Go to Manual Info, type anything and get a Invalid Configuration string.
    1. Test Biometry (Only close the app on the steps required, this is important)
        1. Enable biometry (either Fingerprint, FaceID or TouchID depending on the device)
        1. Send 1 HTR to your own address (it will ask for the biometry instead of pin)
        1. Change the pin
        1. Send 1 HTR to your own address (it will ask for the biometry again)
        1. Close the app and open, it should ask for biometry instead of pin when opening the wallet.
        1. Send 1 HTR to your own address (it will ask for the biometry again)
        1. Disable biometry
        1. Lock wallet and it must require you to type your PIN Code.

1. **Create a new token Tests**
    1. Click on Create a new token.
    1. Enter token name Test Token, and click Next.
    1. Enter token symbol TEST, and click Next.
    1. Enter the amount of 100, and click Next.
    1. Click on create token and check the confirmation message.
    1. After the confirmation message, it must show the Token Details.
    1. Click on the configuration string to copy it.
    1. Click on Share and cancel.
    1. Close the token details.

1. **Send and receive the new token**
    1. Go to the Send Screen and click on Manual Info.
    1. Enter the address of another test wallet.
    1. Change the token to TEST and continue.
    1. Type 3 TEST and send it.
    1. Go to the Receive Screen and click on Payment Request.
    1. Generate a payment request of 2 TEST.
    1. Pay the Payment Request using your test wallet that has just received the TEST before and check the confirmation message.

1. **Register a token Tests**
    1. Go to the Dashboard Screen.
    1. Select the Test Token.
    1. Click on the Token Info and unregister it.
    1. Click on Register Token, click on Manual Info, and paste the Configuration string.
    1. Click on Register Token, and check that the Test Token is back and your balance is 99 TEST.

1. **Reload data**
    1. Turn wifi off until you see the message 'No internet connection.'.
    1. Turn on wifi and check if the wallet reloads the transactions correctly.

1. **Reset Wallet**
    1. Go to Settings and Reset your wallet.
    1. Close and open the app again to make sure that it was properly reset

1. **Import a wallet**
    1. Click on Import Wallet.
    1. Type anything random and check the "Invalid words" error message.
    1. Use the words saved before.
    1. Click on Start the wallet, and wait for it to be initialized. Validate your transactions are loaded.

1. **Wallet Service**
    1. Go to Settings and copy the Unique app identifier
    1. Go to the unleash dashboard and add it to the list of UserIDs
    1. Repeat all steps, starting from step 2

1. **Whitelabel app**
    1. Modify parameters on src/config.js. Set at least `_IS_MULTI_TOKEN = false` and a new `_DEFAULT_TOKEN`.
    1. Rebuild the app.
    1. Verify some changes:
        1. No more Dashboard screen (list of tokens and balances). Should go straight to `_DEFAULT_TOKEN` screen.
        1. On token info screen, there's no more 'Unregister Token' option.
        1. No more register or create token options on Settings screen.
        1. On Send Tokens and Create Payment Request screens, there's no button to select tokens.
        1. [If modified `_PRIMARY_COLOR` on config.js] Colors must have changed.

1. **Translations**
    1. Run `make check_po_strict`.
    1. We should never have any problems with pt-br translation. We should have all texts translated.
    1. Check if all untranslated texts are known.

# Push Notification

## Custom tokens

### Test Token Test (TTT)
It's a regular custom token to test.

```text
[TonyTestToken:TTT:003537ec76f01108262864aaa417f521f26031d172f5bc54f5e3af4d9df7bc73:8b690d38]
```

### Test NFT (TN1)
It's a custom NFT token to test.

```text
[TestNft:TN1:0025dadebe337a79006f181c05e4799ce98639aedfbd26335806790bdea4b1d4:c59a30f8]
```

### Test NFT Test (TNT)
It's a second custom NFT token to test.

```text
[TestNftTest:TNT:00bf95e4edcebb2e9308e5e177d3562b9595844d5b2d42e0a389eb4eb2300644:ad8b0686]
```

## Suggested test sequence

1. **Preparation**
    1. Clear the application storage
    1. Make sure the deviceId is not registered in the unleash **`push-notification.rollout`** feature toggle
    1. If testing the fullnode wallet, make sure the unleash wallet-service feature toggle is disabled
1. **Initialize a new wallet**
    1. You should **not** see a modal to opt-in the push notification yet
    1. Go to the **Settings** page
        1. You should **not** see the **Push Notification** item yet
1. **Turn on the `push-notification` feature toggle**
    1. Go to the settings page
    1. Get the `deviceId` and add it in the `UserIDs` for the stage and platform mobile in the unleash **`push-notification.rollout`** feature toggle.
    1. Wait until the **Push Notification** item shows up in the Settings page
    1. You should see a modal to opt-in the push notification
    1. Click on **Yes, enable**
        1. You should be redirected to **Push Notification** page
1. **Turn off the `push-notification` feature toggle**
    1. **Go to the Settings page**
    1. Remove your `deviceId` from the unleash **`push-notification.rollout`** feature toggle
    1. Wait until the Push Notification item disappears from the Settings page
1. **Test push notification settings on/off**
    1. Turn on the `push-notification` feature toggle
    1. Go to the **Push Notification** page
    1. Turn on the `Enable Push Notification`
    1. Turn on the `Show amounts on notification`
    1. Turn off the `Enabled Push Notification`
    1. Try to turn on the `Show amounts on notification`
        1. it should not be possible
    1. Turn on the `Enabled Push Notification`
        1. `Show amounts on notification` should be on
    1. Turn off the `Show amounts on notification`
    1. Turn off the `Enabled Push Notification`
1. **Try to send a notification with `push-notification` feature toggle turned off**
    1. Go to the **Settings** page
    1. Turn **off** the `push-notifiation` feature toggle
    1. Send HTR to this wallet
        1. Wait some minutes to guarantee you won't receive any notifications for this tx
1. **Try to send a notification with `push-notification` feature toggle turned on**
    1. Go to the **Settings** page
    1. Turn **on** the `push-notifiation` feature toggle
    1. Send HTR to this wallet
        1. Wait some minutes to guarantee you won't receive any notifications for this tx (because the settings `Enable Push Notification` is disabled)
1. **Send a token after turn on `Enable Push Notification` option**
    1. Turn on the `push-notification` feature toggle
    1. Go to the **Push Notification** page
    1. Turn **on** the `Enable Push Notification` option
    1. Send HTR to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction without show amounts
            > There is a new transaction in your wallet.
    1. Dismiss the notification
1. **Send a token after turn on `Show amounts on notification` option**
    1. Turn on the `push-notification` feature toggle
    1. Go to the **Push Notification** page
    1. Turn **on** the `Enable Push Notification` option
    1. Turn **on** the `Show amounts on notification` option
    1. Send HTR to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction showing amounts in the message
            > You have received 0.04 HTR on a new transaction.
    1. Dismiss the notification
1. **View the details of the transaction (foreground)**
    1. Send a token after turn on `Enable Push Notification` option
    1. **Keep the application open**
    1. Click on the notification
    1. Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
    1. Click on the `HTR - HATHOR` item
        1. The **Balance** page should open
1. **View the details of the transaction (quit)**
    > INFO: Notifee v5.7.0 with Android API 32 has a [known issue regarding onBackgroundEvent](https://github.com/invertase/notifee/issues/404).
    1. Turn on the `push-notification` feature toggle
    1. Go to the **Push Notification** page
    1. Turn **on** the `Enable Push Notification` option
    1. **Close the application**
    1. Send HTR to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction without show amounts
            > There is a new transaction in your wallet.
    1. Click on the notification
    1. Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
    1. Click on the `HTR - HATHOR` item
        1. The **Balance** page should open
1. **View the details of the transaction while in foreground starting from lock screen**
    1. Send a token after turn on `Enable Push Notification` option
    1. **Keep the application open**
    1. Go to the Settings screen.
    1. Go to Security
    1. Click on Lock Wallet.
    1. Click on the notification
    1. Unlock the screen
    1. Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
    1. Click on the `HTR - HATHOR` item
        1. The **Balance** page should open
1. **Reset wallet and send a token**
    1. Reset the wallet
    1. Send HTR to this wallet
        1. Wait until the notification arrives
        1. You should **not** receive a notification
    1. Import the wallet
    1. Send HTR to this wallet
        1. Wait until the notification arrives
        1. You should **not** receive a notification
    1. Send a token after turn on `Enable Push Notification` option
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction without show amounts
            > There is a new transaction in your wallet.
        1. Dismiss the notification
1. **Send 2 tokens after turn on `Show amounts on notification` option**
    1. Turn on the `push-notification` feature toggle
    1. Go to the **Push Notification** page
    1. Turn **on** the `Enable Push Notification` option
    1. Turn **on** the `Show amounts on notification` option
    1. Send HTR and TTT to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction showing 2 amounts in the message
            > You have received 0.09 HTR and 0.01 TTT on a new transaction.
    1. Click on the notification
    1. Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
        1. The `TTT - Test Token Test` name should be in gray
    1. Click on the `TTT - Test Token Test` item
        1. Nothing should happen
    1. Click on the `HTR - HATHOR` item
        1. The **Balance** page should open
1. **Send 3 tokens after turn on `Show amounts on notification` option**
    1. Turn on the `push-notification` feature toggle
    1. Go to the **Push Notification** page
    1. Turn **on** the `Enable Push Notification` option
    1. Turn **on** the `Show amounts on notification` option
    1. Send HTR, TTT and TN1 to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction showing 2 amounts in the message
            > You have received 0.05 TN1, 0.03 TTT and 1 other token on a new transaction.
    1. Click on the notification
    1. Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
        1. The `TTT - Test Token Test` name should be in gray
        1. The `TN1 - Test Nft` name should be in gray
    1. Click on the `TTT - Test Token Test` item
        1. Nothing should happen
    1. Click on the `TN1 - Test Nft` item
        1. Nothing should happen
    1. Click on the `HTR - HATHOR` item
        1. The **Balance** page should open
1. **Send 4 tokens after turn on `Show amounts on notification` option**
    1. Turn on the `push-notification` feature toggle
    1. Go to the **Push Notification** page
    1. Turn **on** the `Enable Push Notification` option
    1. Turn **on** the `Show amounts on notification` option
    1. Send HTR, TTT, TN1 and TNT to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction showing 2 amounts in the message
            > You have received 0.08 TNT, 0.05 TN1 and 2 other tokens on a new transaction.
    1. Click on the notification
    1. Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
        1. The `TTT - Test Token Test` name should be in gray
        1. The `TN1 - Test Nft` name should be in gray
        1. The `TNT - Test Nft Test` name should be in gray
    1. Click on the `TTT - Test Token Test` item
        1. Nothing should happen
    1. Click on the `TN1 - Test Nft` item
        1. Nothing should happen
    1. Click on the `TNT - Test Nft Test` item
        1. Nothing should happen
    1. Click on the `HTR - HATHOR` item
        1. The **Balance** page should open
1. **Register `TTT` token and send 2 tokens after turn on `Show amounts on notification` option**
    > WARNING: Not possible using `wallet-service` in `testnet` due to a validation that consults the fullnode.
    > Jump to **Test open the wallet 2 weeks later** (19)
    1. Register `TTT` token in the wallet
    1. Turn on the `push-notification` feature toggle
    1. Go to the **Push Notification** page
    1. Turn **on** the `Enable Push Notification` option
    1. Turn **on** the `Show amounts on notification` option
    1. Send HTR and TTT to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction showing 2 amounts in the message
            > You have received 0.02 TTT and 0.01 HTR on a new transaction.
    1. Click on the notification
    1. Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
        1. The `TTT - Test Token Test` name should be in the primary color (purple)
    1. Click on the `TTT - Test Token Test` item
        1. The **Balance** page for `TTT` token should open
1. **Register `TN1` token and send 2 tokens after turn on `Show amounts on notification` option**
    1. Register `TTT` token in the wallet
    1. Turn on the `push-notification` feature toggle
    1. Go to the **Push Notification** page
    1. Turn **on** the `Enable Push Notification` option
    1. Turn **on** the `Show amounts on notification` option
    1. Send HTR and TN1 to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction showing 2 amounts in the message
            > You have received 0.03 TN1 and 0.02 HTR on a new transaction.
    1. Click on the notification
    1. Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
        1. The `TN1 - Test Nft` name should be in the primary color (purple)
        1. The `TN1 - Test Nft` amount should be integer
    1. Click on the `TN1 - Test Nft` item
        1. The **Balance** page for `TN1` token should open
1. **Send token to self**
    1. Wait some minutes to guarantee you won't receive any notifications for this tx
1. Test open the wallet 2 weeks later
    > WARNING: Skip if running the wallet from store.
    1. Open the file `src/sagas/pushNotification.js` and search for the following assignment:
        ```jsx
        const timeSinceLastRegistration = moment().diff(enabledAt, 'weeks');
        ```
    1. Assign the value `2` to `timeSinceLastRegistration` and save
        ```jsx
        const timeSinceLastRegistration = 2;
        ```
    1. Reload the wallet
    1. You should see a modal asking for a registration refresh
        > This modal only shows up when the user is using the fullnode wallet.
    1. Click on **Refresh**
    1. Enter your pin
    1. Done! You will continue to receive the push notification.
    1. Reassign `timeSinceLastRegistration` with its previous expression:
        ```jsx
        const timeSinceLastRegistration = moment().diff(enabledAt, 'weeks');
        ```
1. **Close test**
    1. Register TNT token
    1. Send back all the tokens to the source wallet
    1. Disable push notification settings
    1. Turn off push notification feature toggle
    1. Unregister the tokens
    1. Reset the wallet
    1. Close the app
    1. Clear the application storage

### Turn on the `wallet-service` feature toggle
1. Get the `deviceId` and add it in the `UserIDs` strategy in the unleash **`wallet-service-mobile-android-testnet.rollout`** feature toggle
1. Turn the feature toggle on

Run all the tests above with the wallet-service turned on. But as a quick test you can run the following test:

1. **Send token after turn on the `wallet-service` feature toggle**
    1. Turn **on** the `push-notification` feature toggle
    1. Turn **on** the `wallet-service` feature toggle
    1. View the details of the transaction (foreground)
    1. View the details of the transaction (quit)
