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
    1. [ ] Clear the application storage
    1. [ ] Make sure the deviceId is not registered in the unleash **`push-notification.rollout`** feature toggle
    1. [ ] If testing the fullnode wallet, make sure the unleash wallet-service feature toggle is disabled

1. **Initialize a new wallet**
    1. [ ] You should **not** see a modal to opt-in the push notification yet
    1. [ ] Go to the **Settings** page
        1. You should **not** see the **Push Notification** item yet

1. **Turn on the `push-notification` feature toggle**
    1. [ ] Go to the settings page
    1. [ ] Get the `deviceId` and add it in the `UserIDs` for the stage and platform mobile in the unleash **`push-notification.rollout`** feature toggle.
    1. [ ] Close the app and open again.
    1. The **Push Notification** item now shows up in the Settings page
1. **Turn off the `push-notification` feature toggle**
    1. [ ] **Go to the Settings page**
    1. [ ] Remove your `deviceId` from the unleash **`push-notification.rollout`** feature toggle
    1. [ ] Wait until the Push Notification item disappears from the Settings page

1. **Test push notification settings on/off**
    1. [ ] Turn on the `push-notification` feature toggle
    1. [ ] Go to the **Push Notification** page
    1. [ ] Turn on the `Enable Push Notification`
    1. [ ] Turn on the `Show amounts on notification`
    1. [ ] Turn off the `Enable Push Notification`
    1. [ ] Try to turn on the `Show amounts on notification`
        1. it should not be possible
    1. [ ] Turn on the `Enable Push Notification`
        1. `Show amounts on notification` should be on
    1. [ ] Turn off the `Show amounts on notification`
    1. [ ] Turn off the `Enable Push Notification`

1. **Try to send a notification with `push-notification` feature toggle turned off**
    1. [ ] Go to the **Settings** page
    1. [ ] Turn **off** the `push-notification` feature toggle
    1. [ ] Send HTR to this wallet
        1. Wait some minutes to guarantee you won't receive any notifications for this tx

1. **Try to send a notification with `push-notification` feature toggle turned on**
    1. [ ] Go to the **Settings** page
    1. [ ] Turn **on** the `push-notification` feature toggle
    1. [ ] Send HTR to this wallet
        1. Wait some minutes to guarantee you won't receive any notifications for this tx (because the settings `Enable Push Notification` is disabled)

1. **Send a token after turn on `Enable Push Notification` option**
    1. [ ] Turn on the `push-notification` feature toggle
    1. [ ] Go to the **Push Notification** page
    1. [ ] Turn **on** the `Enable Push Notification` option
    1. [ ] Send HTR to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction without show amounts
            > There is a new transaction in your wallet.
    1. [ ] Dismiss the notification

1. **Send a token after turn on `Show amounts on notification` option**
    1. [ ] Turn on the `push-notification` feature toggle
    1. [ ] Go to the **Push Notification** page
    1. [ ] Turn **on** the `Enable Push Notification` option
    1. [ ] Turn **on** the `Show amounts on notification` option
    1. [ ] Send HTR to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction showing amounts in the message
            > You have received 0.04 HTR on a new transaction.
    1. [ ] Dismiss the notification

1. **View the details of the transaction (foreground)**
    1. [ ] Send a token after turn on `Enable Push Notification` option
    1. [ ] **Keep the application open**
    1. [ ] Click on the notification
    1. [ ] Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
    1. [ ] Click on the `HTR - HATHOR` item
        1. The **Balance** page should open

1. **View the details of the transaction (quit)**

    >[!NOTE]
    >Notifee v5.7.0 with Android API 32 has a [known issue regarding onBackgroundEvent](https://github.com/invertase/notifee/issues/404).

    1. [ ] Turn on the `push-notification` feature toggle
    1. [ ] Go to the **Push Notification** page
    1. [ ] Turn **on** the `Enable Push Notification` option
    1. [ ] **Close the application**
    1. [ ] Send HTR to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction without show amounts
            > There is a new transaction in your wallet.
    1. [ ] Click on the notification, open the app with your PIN
    1. [ ] Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
    1. [ ] Click on the `HTR - HATHOR` item
        1. The **Balance** page should open

1. **View the details of the transaction while in foreground starting from lock screen**
    1. [ ] Send a token after turn on `Enable Push Notification` option
    1. [ ] **Keep the application open**
    1. [ ] Go to the Settings screen.
    1. [ ] Go to Security
    1. [ ] Click on Lock Wallet.
    1. [ ] Click on the notification
    1. [ ] Unlock the screen
    1. [ ] Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
    1. [ ] Click on the `HTR - HATHOR` item
        1. The **Balance** page should open

1. **Reset wallet and send a token**
    1. [ ] Reset the wallet
    1. [ ] Send HTR to this wallet
        1. Wait until the notification arrives
        1. You should **not** receive a notification
    1. [ ] Import the wallet
    1. [ ] Send HTR to this wallet
        1. Wait until the notification arrives
        1. You should **not** receive a notification
    1. [ ] Send a token after turn on `Enable Push Notification` option
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction without show amounts
            > There is a new transaction in your wallet.
    1. [ ] Dismiss the notification

1. **Send 2 tokens after turn on `Show amounts on notification` option**
    1. [ ] Turn on the `push-notification` feature toggle
    1. [ ] Go to the **Push Notification** page
    1. [ ] Turn **on** the `Enable Push Notification` option
    1. [ ] Turn **on** the `Show amounts on notification` option
    1. [ ] Send HTR and TTT to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction showing 2 amounts in the message
            > You have received 0.09 HTR and 0.01 TTT on a new transaction.
    1. [ ] Click on the notification
    1. [ ] Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
        1. The `TTT - Test Token Test` name should be in gray
    1. [ ] Click on the `TTT - Test Token Test` item
        1. Nothing should happen
    1. [ ] Click on the `HTR - HATHOR` item
        1. The **Balance** page should open

1. **Send 3 tokens after turn on `Show amounts on notification` option**
    1. [ ] Turn on the `push-notification` feature toggle
    1. [ ] Go to the **Push Notification** page
    1. [ ] Turn **on** the `Enable Push Notification` option
    1. [ ] Turn **on** the `Show amounts on notification` option
    1. [ ] Send HTR, TTT and TN1 to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction showing 2 amounts in the message
            > You have received 0.05 TN1, 0.03 TTT and 1 other token on a new transaction.
    1. [ ] Click on the notification
    1. [ ] Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
        1. The `TTT - Test Token Test` name should be in gray
        1. The `TN1 - Test Nft` name should be in gray
    1. [ ] Click on the `TTT - Test Token Test` item
        1. Nothing should happen
    1. [ ] Click on the `TN1 - Test Nft` item
        1. Nothing should happen
    1. [ ] Click on the `HTR - HATHOR` item
        1. The **Balance** page should open

1. **Send 4 tokens after turn on `Show amounts on notification` option**
    1. [ ] Turn on the `push-notification` feature toggle
    1. [ ] Go to the **Push Notification** page
    1. [ ] Turn **on** the `Enable Push Notification` option
    1. [ ] Turn **on** the `Show amounts on notification` option
    1. [ ] Send HTR, TTT, TN1 and TNT to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction showing 2 amounts in the message
            > You have received 0.08 TNT, 0.05 TN1 and 2 other tokens on a new transaction.
    1. [ ] Click on the notification
    1. [ ] Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
        1. The `TTT - Test Token Test` name should be in gray
        1. The `TN1 - Test Nft` name should be in gray
        1. The `TNT - Test Nft Test` name should be in gray
    1. [ ] Click on the `TTT - Test Token Test` item
        1. Nothing should happen
    1. [ ] Click on the `TN1 - Test Nft` item
        1. Nothing should happen
    1. [ ] Click on the `TNT - Test Nft Test` item
        1. Nothing should happen
    1. [ ] Click on the `HTR - HATHOR` item
        1. The **Balance** page should open

1. **Register `TTT` token and send 2 tokens after turn on `Show amounts on notification` option**

    >[!WARNING]
    >Not possible using `wallet-service` in `testnet` due to a validation that consults the fullnode.
    >Jump to **Test open the wallet 2 weeks later**

    1. [ ] Register `TTT` token in the wallet
    1. [ ] Turn on the `push-notification` feature toggle
    1. [ ] Go to the **Push Notification** page
    1. [ ] Turn **on** the `Enable Push Notification` option
    1. [ ] Turn **on** the `Show amounts on notification` option
    1. [ ] Send HTR and TTT to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction showing 2 amounts in the message
            > You have received 0.02 TTT and 0.01 HTR on a new transaction.
    1. [ ] Click on the notification
    1. [ ] Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
        1. The `TTT - Test Token Test` name should be in the primary color (purple)
    1. [ ] Click on the `TTT - Test Token Test` item
        1. The **Balance** page for `TTT` token should open

1. **Register `TN1` token and send 2 tokens after turn on `Show amounts on notification` option**
    1. [ ] Register `TTT` token in the wallet
    1. [ ] Turn on the `push-notification` feature toggle
    1. [ ] Go to the **Push Notification** page
    1. [ ] Turn **on** the `Enable Push Notification` option
    1. [ ] Turn **on** the `Show amounts on notification` option
    1. [ ] Send HTR and TN1 to this wallet
        1. Wait until the notification arrives
        1. You should receive a notification of new transaction showing 2 amounts in the message
            > You have received 0.03 TN1 and 0.02 HTR on a new transaction.
    1. [ ] Click on the notification
    1. [ ] Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
        1. The `TN1 - Test Nft` name should be in the primary color (purple)
        1. The `TN1 - Test Nft` amount should be integer
    1. [ ] Click on the `TN1 - Test Nft` item
        1. The **Balance** page for `TN1` token should open

1. [ ] **Send token to self**
    1. Wait some minutes to guarantee you won't receive any notifications for this tx

1. Test open the wallet 2 weeks later

    >[!WARNING]
    >Skip if running the wallet from store.

    1. [ ] Open the file `src/sagas/pushNotification.js` and search for the following assignment:
        ```jsx
        const timeSinceLastRegistration = moment().diff(enabledAt, 'weeks');
        ```
    1. [ ] Assign the value `2` to `timeSinceLastRegistration` and save
        ```jsx
        const timeSinceLastRegistration = 2;
        ```
    1. [ ] Reload the wallet
        1. You should see a modal asking for a registration refresh
        > This modal only shows up when the user is using the fullnode wallet.
    1. [ ] Click on **Refresh**
    1. [ ] Enter your pin
    1. [ ] Done! You will continue to receive the push notification.
    1. [ ] Reassign `timeSinceLastRegistration` with its previous expression:
        ```jsx
        const timeSinceLastRegistration = moment().diff(enabledAt, 'weeks');
        ```

1. **Close test**
    1. [ ] Register TNT token
    1. [ ] Send back all the tokens to the source wallet
    1. [ ] Disable push notification settings
    1. [ ] Turn off push notification feature toggle
    1. [ ] Unregister the tokens
    1. [ ] Reset the wallet
    1. [ ] Close the app
    1. [ ] Clear the application storage

### Turn on the `wallet-service` feature toggle
1. [ ] Get the `deviceId` and add it in the `UserIDs` strategy in the unleash **`wallet-service-mobile-android-testnet.rollout`** feature toggle
1. [ ] Turn the feature toggle on

Run all the tests above with the wallet-service turned on. But as a quick test you can run the following test:

1. **Send token after turn on the `wallet-service` feature toggle**
    1. [ ] Turn **on** the `push-notification` feature toggle
    1. [ ] Turn **on** the `wallet-service` feature toggle
    1. [ ] View the details of the transaction (foreground)
    1. [ ] View the details of the transaction (quit)

