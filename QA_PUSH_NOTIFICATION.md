# Push Notification

Some of the tests in this section require the Push Notification Feature Toggle to be enabled or disabled for the device. You can set this configuration on **`push-notification.rollout`** on Unleash.
To make sure the settings were correctly applied, close the app and open it again after each enable/disable toggle on Unleash, unless stated explicitly in the test steps.

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

### Preparation
1. Ensure the Push Notification Unleash Feature Toggle is 🚫**disabled** for this device.
1. If testing the fullnode wallet, make sure the unleash `wallet-service` feature toggle is also disabled

### Initialize a new wallet with no push feature
1. You should **not** see a modal to opt-in the push notification yet
1. Go to the **Settings** page
1. You should **not** see the **Push Notification** item yet
1. Send HTR to this wallet
  1. Wait some minutes to guarantee you won't receive any notifications for this tx

### Initialize a new wallet with push feature enabled
1. Ensure the Push Notification Unleash Feature Toggle is ✅**enabled** for this device.
1. Check the **Push Notification** item now shows up in the Settings page
1. Stay in the "Settings" page and turn off the Unleash `push-notification` Feature Toggle for this device
1. Do not close nor reload the app.
1. Wait until the Push Notification item disappears from the Settings page

### Toggle push notification settings on/off
1. Ensure the Push Notification Unleash Feature Toggle is ✅**enabled** for this device.
1. Go to the **Settings -> Push Notification** page
1. Turn on the `Enable Push Notification` and the `Show amounts on notification` options
1. Turn off the `Enable Push Notification`
1. Try to turn on the `Show amounts on notification`
   1. It should not be possible: the component is disabled
   1. The value should stay on, as it was before
1. Turn on the `Enable Push Notification`
   1. `Show amounts on notification` should still be on
1. Turn off the `Show amounts on notification`
1. Turn off the `Enable Push Notification`. Both options must now be off.

### Receive a push notification for a new transaction
1. Ensure the Push Notification Unleash Feature Toggle is ✅**enabled** for this device.
1. Ensure the `Enable Push Notification` option is 🚫**off** 
1. Send HTR to this wallet
   1. Wait some minutes to guarantee you will **not** receive any notifications for this tx
1. Navigate to the **Settings -> Push Notification** page and turn on the `Enable Push Notification` option
1. Send HTR to this wallet
   1. Wait until the notification arrives
   1. You should receive a notification of new transaction without show amounts: "There is a new transaction in your wallet."

### Receive a push notification with amounts
1. Ensure the Push Notification Unleash Feature Toggle is ✅**enabled** for this device.
1. Ensure the `Enable Push Notification` option is ✅**on**
1. Navigate to the **Settings -> Push Notification** page and turn on the `Show amounts on notification` option
1. Send HTR to this wallet
   1. Wait until the notification arrives
   1. You should receive a notification of new transaction showing amounts in the message: "You have received 0.04 HTR on a new transaction."

### Click a push while the app is unlocked
1. Ensure the `Enable Push Notification` option is ✅**on**
1. Send HTR to this wallet and keep the application open
1. Click on the notification when it arrives
1. Check that the modal with tx details is opened
   1. The `HTR - HATHOR` name should be in the primary color (purple)
1. Click on the `HTR - HATHOR` item
   1. The **Balance** page should open

### Click a push while the app is closed

>[!NOTE]
>Notifee v5.7.0 with Android API 32 has a [known issue regarding onBackgroundEvent](https://github.com/invertase/notifee/issues/404).

1. Ensure the `Enable Push Notification` option is ✅**on**
1. Close the application
1. Send HTR to this wallet and wait until the notification arrives
1. Click on the notification, open the app with your PIN
1. Check that the modal with tx details open

### Click a push while the app is locked
1. Ensure the `Enable Push Notification` option is ✅**on**
1. Keep the application open in the Locked Screen
1. Send HTR to this wallet and wait until the notification arrives
1. Click on the notification, unlock the app
1. Check that the modal with tx details is opened correctly

### Receive a push after wallet reset/import
1. Reset the wallet
1. Send HTR to the wallet that was just reset
   1. Check that the notification never arrives
1. Import the wallet again
1. Send HTR to this wallet before activating push notification again
  1. Check that the notification never arrives
1. Activate `Enable Push Notification` option in the Settings
   1. Check that the notification arrives correctly

## Multiple Tokens tests
All of the tests below require some preparations to work properly:
1. Both the `Enable Push Notification` and `Show amounts on notification` options to be ✅**on**.
1. The Custom Tokens must be available and registered on another wallet but **unregistered** on the wallet being tested.
1. We will call those tokens `TK1`, `TK2`, `TK3`, `TK4` and `NFT1` for simplicity, but any custom tokens can be used.

### Receiving push for tx with 2 tokens
1. Send HTR and TK1 to this wallet
1. Check the push message contain both token symbols: `You have received 0.09 HTR and 0.01 TK1 on a new transaction.`
1. Click on the notification and check the modal with tx details:
   1. The `HTR - HATHOR` name should be in the primary color (purple)
   1. The `TK1 - Token 01` name should be in gray
1. Click on the gray item and check that nothing happens
1. Click on the `HTR` item and check that the **Balance** page opens

### Receiving push for tx with 3 tokens
1. Send HTR, TK1 and TK2 to this wallet
1. Check the push message contain the following properties:
   1. Only two token symbols are shown on the message: `You have received 0.05 TK1, 0.03 TK2 and 1 other token on a new transaction.`
   1. Check that the tokens with the most amount are shown first, in descending order
1. Click on the notification
1. Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
        1. The unregistered custom tokens names should be in gray
1. Click on each of the gray items and check that nothing happens
1. Click on the `HTR` item and check that the **Balance** page opens

### Receiving push for tx with 4 tokens
1. Send HTR, TK1, TK2 and TK3 to this wallet
1. Check the push message contain the following properties:
  1. Only two token symbols are shown on the message: `You have received 0.08 TNT, 0.05 TN1 and 2 other tokens on a new transaction.`
  1. Check that the tokens with the most amount are shown first, in descending order
1. Click on the notification
1. Wait until the modal with tx details open
        1. The `HTR - HATHOR` name should be in the primary color (purple)
        1. The custom tokens should be in gray
1. Click on each of the gray items and check that nothing happens
1. Click on the `HTR` item and check that the **Balance** page opens

### Receiving push for tx with a registered custom token
1. Register only the TK2 token in the wallet
1. Send HTR, TK1 and TK2 to this wallet.
1. Check the push message is equal to the "unregistered" test above: `You have received 0.05 TK1, 0.03 TK2 and 1 other token on a new transaction.`
1. Click the notification and check the modal with tx details:
   1. The `HTR - HATHOR` name should be in the primary color (purple)
   1. The `TK1 - Token 01` name should be in gray
   1. The `TK2 - Token 02` name should be in the primary color (purple)
1. Click on the `TK2` item and check that the **Balance** page opens for this token

### Receiving push for tx with an NFT token
1. Send HTR and NFT1 to this wallet
1. Check the push message shows NFT amount as an integer with no decimal cases: `You have received 9 NFT1 and 0.02 HTR on a new transaction.`
1. Click on the notification and check that the modal displays only the amount of `NFT1` as an integer with no decimal cases.


### Sending token to self
1. Send HTR from the test wallet to itself
2. Wait some minutes to guarantee you won't receive any notifications for this tx

### Test open the wallet 2 weeks later

>[!WARNING]
>Skip if running the wallet from store.

1. Open the file `src/sagas/pushNotification.js` and search for the following assignment:
```jsx
const timeSinceLastRegistration = moment().diff(enabledAt, 'weeks');
```
1. Assign the value `2` to `timeSinceLastRegistration` and save
```jsx
const timeSinceLastRegistration = 2;
```
1. Reload the wallet
   1. You should see a modal asking for a registration refresh: `This modal only shows up when the user is using the fullnode wallet.`
1. Click on **Refresh**
1. Enter your pin
1. Done! You will continue to receive the push notification.
1. Reassign `timeSinceLastRegistration` with its previous expression:
```jsx
const timeSinceLastRegistration = moment().diff(enabledAt, 'weeks');
```

### Turn on the `wallet-service` feature toggle
1. Get the `deviceId` and add it in the `UserIDs` strategy in the unleash **`wallet-service-mobile-android-testnet.rollout`** feature toggle
1. Turn the feature toggle on

Run all the tests above with the wallet-service turned on. But as a quick test you can run the following test:

### Send token after turn on the `wallet-service` feature toggle
1. Turn **on** the `push-notification` feature toggle
1. Turn **on** the `wallet-service` feature toggle
1. View the details of the transaction (foreground)
1. View the details of the transaction (background)

