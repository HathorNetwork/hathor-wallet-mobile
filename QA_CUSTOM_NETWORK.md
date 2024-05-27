# Custom Network

1. **Settings screen**
    1. [ ] Go to Settings
    1. [ ] Check you see "General Settings" as the title for the first collection of settings
    1. [ ] Check you see "Developer Settings" as the title for the second collection of settings

1. **Risk Disclaimer screen**
    1. [ ] Go to Network Settings
    1. [ ] Ensure you see the `RISK DISCLAIMER` screen
    1. [ ] Verify that there is a disclaimer text on a yellow background
    1. [ ] Confirm there is a button at the bottom of the page to acknowledge the disclaimer

1. **Network Pre-Settings Screen**
    1. [ ] Click on "I UNDERSTAND"
    1. [ ] Check you see the `NETWORK PRE-SETTINGS` screen
    1. [ ] Check you see two pre-settings options: Mainnet and Testnet
    1. [ ] Check you see a button at the bottom of the page to customize the network

1. **CUSTOM NETWORK SETTINGS Screen**
    1. [ ] Click on "CUSTOMIZE"
    1. [ ] Check you see the `CUSTOM NETWORK SETTINGS` screen
    1. [ ] Check you see a warning message text in a yellow background
    1. [ ] Check you see a form with the following values:
        - Node URL
        - Explorer URL
        - Explorer Service URL
        - Transaction Mining Service URL
        - Wallet Service URL (optional)
        - Wallet Service WS URL (optional)

        >[!INFO]
        >Wallet Service fields only appears if the wallet is allowed on Wallet Service feature.

    1. [ ] Check you see a button at the bottom of the page to send the form

1. **Send the default network settings**
    1. [ ] Click on "SEND"
    1. [ ] Verify that the wallet has successfully reloaded
    1. [ ] Ensure that a success feedback modal appears following the reload
    1. [ ] Dismiss the success feedback modal

1. **Send an invalid Node URL**
    1. [ ] Empty the Node URL field
    1. [ ] Check that an invalidation message appears under the field informing Node URL is required
    1. [ ] Fill the field with an invalid URL, e.g. "invalid"
    1. [ ] Check that an invalidation message appears under the field informing Node URL should be a valid URL

1. **Send a custom network**
    1. [ ] Navigate back to Network Pre-Settings screen
    1. [ ] Click on "CUSTOMIZE" again
    1. [ ] Fill the "Node URL" field with the value "https://node1.mainnet.hathor.network/v1a/"
    1. [ ] Click on "SEND"
    1. [ ] Wait the wallet reload
    1. [ ] Check if a success feedback modal has appeared
    1. [ ] Dismiss the success feedback modal
    1. [ ] Verify that a network status bar with a yellow background and the message "Custom network: mainnet" is visible at the top of the screen

1. **Restoring to mainnet**
    1. [ ] Navigate back to Network Pre-Settings screen
    1. [ ] Click on "Mainnet" option
    1. [ ] Wait for the wallet to reload
    1. [ ] Check a success feedback modal has appeared
    1. [ ] Dismiss the success feedback modal
    1. [ ] Ensure that the network status bar at the top of the screen has disappeared

1. **Check testnet balance**
    >[!NOTE]
    >In this test we want to check the difference of transaction history and balance between mainnet and testnet of the same wallet. Therefore, you should have some transactions also in your testnet wallet.

    1. [ ] Click on "Testnet" option
    1. [ ] Wait for the wallet to reload
    1. [ ] Check a success feedback modal has appeared
    1. [ ] Dismiss the success feedback modal
    1. [ ] Verify that a network status bar with a yellow background and the message "Custom network: testnet" is visible at the top of the screen
    1. [ ] Go to the Home screen
    1. [ ] Check the balance of Hathor token
    1. [ ] Click on Hathor token
    1. [ ] Check you see different transactions from "mainnet"
    1. [ ] Click on a transaction
    1. [ ] Click on the "Public Explorer" item
    1. [ ] Verify that you were redirected to the transaction page on the testnet explorer

1. **Check registered tokens are cleaned when changing network settings**
    1. [ ] Register a token on Mainnet network
    1. [ ] Navigate to Network Pre-Settings screen
    1. [ ] Select the Testnet network
    1. [ ] Navigate to Mainscreen
    1. [ ] Check there is only the HTR token in the dashboard

1. **Check Wallet Service fields didn't appear when Wallet Service is disabled for the wallet**
    1. [ ] Go to Unleash and disables the Wallet Service for the wallet
        1. You should set this configuration on `wallet-service-mobile.rollout`
    1. [ ] Close and reopens the App
    1. [ ] Navigate Custom Network Settings screen on Network Settings feature
    1. [ ] Check the Wallet Service fields do not appear

1. **Check Wallet Service fields disable Push Notification when they are empty**
    1. [ ] Go to Unleash and enables the Wallet Service for the wallet
        1. You should set this configuration on `wallet-service-mobile.rollout`
    1. [ ] Close and reopens the App
    1. [ ] Navigate Custom Network Settings screen on Network Settings feature
    1. [ ] Check the Wallet Service fields do appear
    1. [ ] Make both Wallet Service fields empty
    1. [ ] Navigate to Settings screen
    1. [ ] Check the Push Notification option didn't appear

1. **Check Wallet Service fields can't be empty unilaterally**
    1. [ ] Go to Unleash and enables the Wallet Service for the wallet
        1. You should set this configuration on `wallet-service-mobile.rollout`
    1. [ ] Close and reopens the App
    1. [ ] Navigate Custom Network Settings screen on Network Settings feature
    1. [ ] Check the Wallet Service fields do appear
    1. [ ] Make one of the Wallet Service fields empty
    1. [ ] Send the custom settings
        1. You should see an error message under the field

1. **Check Push Notification aren't available on Testnet**
    1. [ ] Navigate to Network Pre-Settings screen
    1. [ ] Select Testnet pre-settings
    1. [ ] Navigate to Settings screen
    1. [ ] Check Push Notification didn't appear

1. **Check Push Notification aren't beeing received on Testnet**
    1. [ ] Go to Unleash and enables the Wallet Service for the wallet
        1. You should set this configuration on `wallet-service-mobile.rollout`
    1. [ ] Navigate to Network Pre-Settings screen
    1. [ ] Select Mainnet pre-settings
    1. [ ] Enables Push Notification
    1. [ ] Send a transaction to your wallet from another wallet
        1. You should receive a push notification
    1. [ ] Navigate to Network Pre-Settings screen
    1. [ ] Select Testnet pre-settings
    1. [ ] Send a transaction to your wallet from another wallet
        1. You should **not** receive a push notification
