# Suggested Test Sequence

1. **App update**
    1. Load the last release of the app and start a wallet. You can confirm the version on Settings -> About.
    1. Update the code to run the latest version, without resetting the wallet.
    1. You should be shown the PIN screen. Unlock the wallet and confirm load succeeded.
    1. Check if the Wallet Service is active for this device. This will be important to understand the context in which the following tests in this guide will be executed
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
    1. Enter the address `WZ7pDnkPnxbs14GHdUFivFzPbzitwNtvZo` and click Next.
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
    1. Go to the Settings Screen. Take note of the network you're connected to ( `testnet` or `mainnet` ).
    1. Test Security > Lock Wallet.
        1. Enable biometry
        1. Lock wallet and use biometry.
        1. Disable biometry.
        1. Lock wallet, and it must require you to type your PIN Code.
    1. Test Security > Change PIN.
        1. Close and open the app and check whether the wallet unlocks correctly.
    1. Open About and go back.
    1. Click on Register a Token and check whether the camera loads correctly.
    1. Go to Manual Info, type anything and get an Invalid Configuration string.

1. **Biometry tests (Only close the app on the steps required, this is important)**
    1. Test old Biometry mode
        1. Go to unleash and disable the `safe-biometry-mode.rollout` for this wallet.
        1. Close the app and open, navigate to Settings > Security.
        1. Enable biometry (either Fingerprint, FaceID or TouchID depending on the device)
        1. Send 1 HTR to your own address (it will ask for the biometry instead of pin)
        1. Change the pin
        1. Send 1 HTR to your own address (it will ask for the biometry again)
        1. Close the app and open, it should ask for biometry instead of pin when opening the wallet.
        1. Send 1 HTR to your own address (it will ask for the biometry again)
        1. Disable biometry
        1. Lock wallet, and it must require you to type your PIN Code.
    1. Test safe Biometry mode
        1. Go to unleash and enable the `safe-biometry-mode.rollout` for this wallet.
        1. Enable biometry (either Fingerprint, FaceID or TouchID depending on the device, it will require your pin)
        1. Check that the "Change PIN" option is no longer on the list.
        1. Create a transaction to send 1 HTR to your own address, when prompted for the biometry press cancel.
        1. It should show an error message, press anywhere outside to close the message.
        1. Try again but this time actually send the 1 HTR.
        1. Close the app and open, it should ask for biometry instead of pin when opening the wallet.
        1. When prompted for the biometry, press cancel, it should show a message that biometry failed.
        1. At the bottom of the screen there should be a "try again" and a "reset wallet" buttons.
        1. Press "try again" and actually unlock the wallet.
        1. Send 1 HTR to your own address (it will ask for the biometry again)
        1. Disable biometry (it will ask for the biometry)
        1. Check that the "Change PIN" option appears on the list.
        1. Lock wallet and it must require you to type your PIN Code.
    1. Test biometry mode migration
        1. Go to unleash and disable the `safe-biometry-mode.rollout` for this wallet.
        1. Close the app and open, navigate to Settings > Security.
        1. Enable biometry (either Fingerprint, FaceID or TouchID depending on the device)
        1. Close the app and open, it should ask for biometry instead of pin when opening the wallet.
        1. Go to unleash and enable the `safe-biometry-mode.rollout` for this wallet.
        1. After some moments the app should lock by itself and request biometry to open.
        1. Unlock the wallet and check that the history loads properly.
        1. Go to unleash and disable the `safe-biometry-mode.rollout` for this wallet.
        1. After some moments the wallet should lock by itself and request a biometry to open.
        1. Unlock the wallet and check that the history loads properly.

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

1. **Send HTR with QR Code**
    1. Generate a payment request requesting 1 HTR from another device
    1. Use the Mobile Wallet QR code scanner to read the QR code from this other device
    1. Pay the Payment Request, the transaction should be successful

1. **Register a token Tests**
    1. Go to the Dashboard Screen.
    1. Select the Test Token.
    1. Click on the Token Info and unregister it.
    1. Click on Register Token, click on Manual Info, and paste the Configuration string.
    1. Click on Register Token, and check that the Test Token is back and your balance is 99 TEST.

1. **Reload data**
    1. Turn Wi-Fi off until you see the message 'No internet connection.'.
    1. Turn on Wi-Fi and check if the wallet reloads the transactions correctly.

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
    1. Run `make check_i18n`.
    1. We should never have any problems with pt-br translation. We should have all texts translated.
    1. Check if all untranslated texts are known.

# Push Notification

Follow the [Push Notification QA](./QA_PUSH_NOTIFICATION.md) steps.

# Custom Network

Follow the [Custom Network QA](./QA_CUSTOM_NETWORK.md) steps.
