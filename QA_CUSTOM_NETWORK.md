# Custom Network

Some of the tests in this section require the Wallet Service to be enabled or disabled for the wallet. You can set this configuration on `wallet-service-mobile.rollout` on Unleash.
To make sure the settings were correctly applied, close the app and open it again after each enable/disable toggle on Unleash.

### Custom Network Pre-Settings
1. Navigate to Settings -> "Developer Settings" -> "Network Settings"
1. Ensure you see the `RISK DISCLAIMER` screen
1. Check you see two pre-settings options: Mainnet and Testnet
1. Check you see a button at the bottom of the page to customize the network

### Custom Network Settings
1. Click on "CUSTOMIZE"
1. Check you see a warning message about token value in a yellow background
1. Check you see a form with the following values:
    - Node URL
    - Explorer URL
    - Explorer Service URL
    - Transaction Mining Service URL
    - Wallet Service URL (optional)
    - Wallet Service WS URL (optional)

>[!NOTE]
> Wallet Service fields only appear if the wallet is allowed on Unleash for the Wallet Service.

### Send the default network settings
1. Click on "SEND" and verify that the wallet has successfully reloaded
1. Ensure that a success feedback modal appears following the reload

### Send an invalid Node URL
1. Empty the Node URL field
1. Check that an invalidation message appears under the field informing Node URL is required
1. Fill the field with an invalid URL, e.g. "invalid"
1. Click the "Send" button
1. Check that an invalidation message appears under the field informing Node URL should be a valid URL

### Send a custom network
1. Navigate back to Network Pre-Settings screen and start another customization
1. Fill the "Node URL" field with the value "https://node1.mainnet.hathor.network/v1a/"
1. Click on "SEND", check if a success feedback modal has appeared
1. Verify that a network status bar with a yellow background and the message "Custom network: mainnet" is visible at the top of the screen

### Restoring to mainnet
1. Navigate back to Network Pre-Settings screen and click on the "Mainnet" pre-setting option
1. Check a success feedback modal has appeared
1. Ensure that the network status bar at the top of the screen has disappeared

### Check testnet balance

>[!NOTE]
> In this test we want to check the difference of transaction history and balance between mainnet and testnet of the same wallet. Therefore, you should have some transactions also in your testnet wallet.

1. Click on "Testnet" pre-setting option
1. Verify that a network status bar with a yellow background and the message "Custom network: testnet" is visible at the top of the screen
1. Go to the Home screen
1. Check you see different balance from "mainnet"
1. Check you see different transactions from "mainnet"
1. Click on a transaction
1. Click on the "Public Explorer" item
1. Verify that you were redirected to the transaction page on the testnet explorer

### Check registered tokens are cleaned when changing network settings
1. Register a token on Mainnet network
1. Navigate to Network Pre-Settings screen
1. Select the Testnet network
1. Navigate to Mainscreen
1. Check there is only the HTR token in the dashboard
1. Register a token on Testnet network
1. Switch back to the Mainnet network
1. Check there is only the HTR token in the dashboard

### Check some fields don't appear when Wallet Service is disabled for the wallet
1. Ensure the **Wallet Service** Unleash Feature Toggle is 🚫**disabled** for this device.
1. Navigate Custom Network Settings screen on Network Settings feature
1. Check the Wallet Service fields do not appear

### Check Wallet Service fields disable Push Notification when they are empty
1. Ensure the **Wallet Service** Unleash Feature Toggle is ✅**enabled** for this device.
1. Navigate to the Custom Network Settings screen on Network Settings feature
1. Check that the Wallet Service fields do appear
1. Make both Wallet Service fields empty and apply the changes.
1. Navigate to Settings screen and check the Push Notification option isn't available

### Check Wallet Service fields can't be empty unilaterally
1. Ensure the **Wallet Service** Unleash Feature Toggle is ✅**enabled** for this device.
1. Navigate to the Custom Network Settings screen on Network Settings feature
1. Check the Wallet Service fields do appear
1. Make one of the Wallet Service fields empty
1. Click "Send" and check the error message for that empty field

### Check Push Notifications aren't available on Testnet
1. Switch to the Testnet network pre-settings
1. Check Push Notification didn't appear

### Check Push Notifications aren't being received on Testnet
1. Ensure the **Wallet Service** Unleash Feature Toggle is ✅**enabled** for this device.
1. Switch to the Mainnet pre-settings
1. Enable Push Notification
1. Send a transaction from another wallet to your mobile wallet
    1. You should receive a push notification
1. Switch to the Testnet pre-settings
1. Send a transaction to your wallet from another wallet
    1. You should **not** receive a push notification
