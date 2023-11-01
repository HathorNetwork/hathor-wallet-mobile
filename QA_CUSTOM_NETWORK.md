# Custom Network

1. **Settings screen**
    1. Go to Settings
    1. Check you see "General Settings" as the title for the first collection of settings
    1. Check you see "Developer Settings" as the title for the second collection of settings

1. **Risk Disclaimer screen**
    1. Go to Network Settings
    1. Check you see the `RISK DISCLAIMER` screen
    1. Check you see a disclaimer text in a yellow background
    1. Check you see a button in the end of the page to confirm the disclaimer

1. **Network Pre-Settings Screen**
    1. Click on "I UNDERSTAND"
    1. Check you see the `NETWORK PRE-SETTINGS` screen
    1. Check you see two pre-settings options: Mainnet and Testnet
    1. Check you see a button in the end of the page to customize the network

1. **CUSTOM NETWORK SETTINGS Screen**
    1. Click on "CUSTOMIZE"
    1. Check you see the `CUSTOM NETWORK SETTINGS` screen
    1. Check you see a warning message text in a yellow background
    1. Check you see a form with the following values:
        - Node URL
        - Explorer URL
        - Explorer Service URL
        - Wallet Service URL (optional)
        - Wallet Service WS URL (optional)
    1. Check you see a button in the end of the page to send the form

1. **Send the default network settings"
    1. Click on "SEND"
    1. Check that the wallet has reloaded
    1. Check that a success feedback modal has raised after reload
    1. Dismiss the success feedback modal

1. **Send an invalid Node URL**
    1. Emmpty the Node URL field
    1. Check that an invalidation message appears under the field informing Node URL is required
    1. Fill the field with an invalid URL "invalid"
    1. Check that an invalidation message appears under the field informing Node URL should be a valid URL

1. **Send a custom network**
    1. Navigate back to Network Pre-Settings screen
    1. Click on "CUSTOMIZE" again
    1. Fill the "Node URL" field with the value "https://node1.mainnet.hathor.network/v1a/"
    1. Click on "SEND"
    1. Wait the wallet reload
    1. Check a success feedback modal has appeared
    1. Dismiss the success feedback modal
    1. Check you see a network status bar with yellow background has appeared on top containing the message "Custom network: mainnet"

1. **Restoring to mainnet**
    1. Navigate back to Network Pre-Settings screen
    1. Click on "Mainnet" option
    1. Wait the wallet reload
    1. Check a success feedback modal has appeared
    1. Dismiss the success feedback modal
    1. Check the network status bar on the top has disappeared

1. **Check testnet balance**
    >[!NOTE]
    >In this test we want to check the difference of transaction history and balance between mainnet and testnet of the same wallet. Therefore, you should have some transactions also in your testnet wallet.

    1. Click on "Testnet" option
    1. Wait the wallet reload
    1. Check a success feedback modal has appeared
    1. Dismiss the success feedback modal
    1. Check you see a network status bar with yellow background has appeared on top containing the message "Custom network: testnet"
    1. Go to the Home screen
    1. Check the balance of Hathor token
    1. Click on Hathor token
    1. Check you see different transactions from "mainnet"
    1. Click on a transaction
    1. Click on the "Plublic Explorer" item
    1. Check you was redirected to the transaction page on testnet explorer



