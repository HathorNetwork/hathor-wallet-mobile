# QA Nano Contract

- CTA: call-to-action
- Bet Hotsite: https://staging.betting.hathor.network/ or a locally ran dApp like the [Bet dApp](https://github.com/hathornetwork/bet-dapp)

### Hidden tab when disabled
1. Make sure the nano-contract feature is 🚫**disabled** for the device
1. Check a toggle button with two options **does not appear** in the dashboard head
	1. Tokens
	1. Nano

### Activation
1. Make sure the **wallet-service** feature is 🚫**disabled** for the device
1. Make sure the **nano-contract** feature is ✅**enabled** for the device
1. Make sure to connect to a network that supports Nano Contracts, like `testnet-india`
1. Check a toggle button with two options appear in the dashboard head
	1. Tokens
	1. Nano

### Nano Contract Details
1. Check the option "Tokens" is selected
1. Select the option "Nano Contracts"
1. Check the Nano Contract component is in focus with a title "No Nano Contracts"
1. Check the *Nano Contract Details* component has:
	1. a message, and
	1. a call-to-action (CTA) "Register new"

### Register Nano Contract
1. Register a new Nano Contract by tapping over "Register new" on *Nano Contract Details*
	1. It may focus on a component of loading
1. Check the Nano Contract Registration screen contains:
  1. a Nano Contract ID input
  1. a Wallet Address loaded
  1. a disabled "REGISTER NANO CONTRACT" button
1. Try to register an invalid Nano Contract ID ( ex.: use the id for a common transaction or a random 64-char string )
1. Check for a failure feedback modal to appear and dismiss it
1. Clear the input and check if a validation error message appeared under it
1. Check if the "REGISTER NANO CONTRACT" button is disabled
1. Type any input and check if the error messages disappeared and the button is enabled

### Register Nano Contract using the right network
1. Click the "Nano Contracts" tab on the dashboard
1. Tap on "Register new" and type an invalid Nano Contract ID for the current network ( such as `00005e2f39f2f7a0997338da89e76e638ef3ee80b1b9fb2bcd5b494750792d21` )
  - Check that an error is shown.
1. Tap on "Register new" and type a valid Nano Contract ID for the current network
  1. You can check "Nano" tab in the Explorer for the connected network for valid Nano Contract IDs
  1. For `testnet-india` network, you can use the Nano Contract ID `00000c1957be0e981f24cbf9699a15184de724e1c40d54c74930b8a5cb18de3e`
1. Tap on "REGISTER NANO CONTRACT" button
1. Check for a success feedback modal to appear
	1. If a failure feedback modal appear with the message "The informed address does not belong to the wallet", this may indicate a problem with the backend, especially the Wallet Service. In this case, please report the issue to the development team for further investigation.
1. Check the feedback modal has:
	1. A message informing the registration was successful
	1. A "SEE CONTRACT" button
1. Tap on "SEE CONTRACT" button and check that the *Nano Contract Details* screen is in focus

### Inspect Nano Contract Details
1. Ensure you are in the *Nano Contract Details* screen
1. Check there is at least one transaction listed, the "initialize"
1. Tap multiple times on "Nano Contract" header to expand and hide it
1. With this section expanded, check it has the fields:
  1. Nano contract ID, with eclipsed value
  1. Contract name
  1. Registered address
1. Check the field "Registered Address" is clickable and shows a modal
1. Dismiss this modal and, back to the details screen check there are two CTAs side-by-side:
	1. "See status details"
	1. "Unregister contract"
1. Tap on "See status details" CTA:
	1. A browser app should open in the explorer page of the Nano Contract and it should contain all Nano Contract details
1. Go back to the wallet and tap on "Registered Address"
1. Check for a "Choose New Wallet Address" modal appears
1. Check the address of *index 0* is selected. Select any other.
1. The "New Nano Contract Address" modal shown has:
	1. An information content informing user this address is used to sign a transaction within the Nano Contract
	1. A mirror content informing the selected address and its index
	1. Confirmation and cancellation buttons
1. Tap on "GO BACK" button and check the modal is dismissed
1. Select any other indexed address and confirm the selection
1. Check for the new address is set on "Registered Address" field
1. Tap on "Registered Address" and check the correct address is selected
1. Dismiss the modal and tap on "Unregister contract" CTA
1. Check for a new "Unregister Nano Contract" modal appear
1. Cancel the action and check it dismisses the modal
1. Tap on "Unregister contract" and confirm the action
1. Check the *Dashboard* screen is on focus
1. Check the Nano Contract list is empty
	1. It shows title "No Nano Contracts"

### Inspect Nano Contract Transaction
1. Register a valid Nano Contract with many transaction such as `00000c1957be0e981f24cbf9699a15184de724e1c40d54c74930b8a5cb18de3e`
1. Go the *Nano Contract Details* screen
1. Check there are many transactions
1. Check a transaction item has:
	1. An eclipsed Transaction ID value in bold format
	1. A method name for the transaction
	1. A humanized timestamp
1. Check any item is actionable
1. Check the transaction list is ordered from newest to oldest
1. Check the oldest transaction is the `initialize`. Tap it.
1. Check the *Nano Contract Transaction* screen is on focus. Validate its fields:
  1. a "Transaction ID" field with eclipsed value as a header
  1. an expanded header
  1. a label with value "Executed" in green
  1. a "Transaction ID" field with eclipsed value
  1. a "Nano Contract ID" field with eclipsed value
  1. a "Blueprint Method" field and value
  1. Check there ia a "Date and Time" field and value
  1. a "Caller" field with eclipsed value
  1. a "See transaction details" CTA
1. Tap on "See transaction details" CTA
  1. A browser app should open in the explorer page of the Transaction
1. Go back to the wallet and tap on any area of the header to shrink it
1. Check there is a content area under the header with title "No Actions"
1. Go back to *Nano Contract Details* screen and select another action
1. Check there is an action as a content that has:
	1. A description of the action
	1. An Input ID with eclipsed value, if it's a deposit or withdrawal
	1. An action amount

### Change network and reset registered Nano Contracts
1. Switch to the `mainnet` network
1. If it has a "Nano Contracts" tab, select it. If not, switch back to `testnet`
1. Check there is no Nano Contract registered

## Reown tests

### Connect to a dApp using ReOwn
1. Open the Hathor Network [Bet dApp hotsite](https://staging.betting.hathor.network/) or other source of RPC requests
1. Start the process to connect your wallet using the WalletConnect/ReOwn option
1. Reject the connection and check the hotsite just closes the QR Code modal
1. Start again but this time connect your wallet
1. Check the Bet dApp is now connected to your wallet through the "Hathor Bet" ReOwn session on the Wallet

### Create a Bet nano contract
1. On the Bet dApp hotsite, create a simple Bet nano contract with:
  - Random results
  - Two different possible outcomes
1. A screen should be opened on the wallet to confirm the creation of the Bet nano contract
1. Check that the screen has all the information about the nano contract
   - Blueprint Id
   - Contract name
   - Method "initialize"
   - Caller address ( actionable )
   - Argument "oracle_script"
   - Argument "token_uid" as HTR
   - Date last bet in a human readable date and time
1. Click "Decline Transaction" and then "No, Go Back"
1. Check that the user is still on the reviewing screen
1. Click "Decline Transaction" and then confirm. Check the wallet navigates to the Dashboard
1. The hotsite displays an error during confirmation message
1. Try again and this time confirm the contract creation
1. The hotsite should display a message about waiting for block confirmation
1. After a while, the hotsite should display the success message and a CTA to create a bet

### Create a Bet
1. On the Bet dApp hotsite, create a simple Bet with 1 HTR and one of the options
1. The wallet should open a screen about a nano contract not found
1. The options for the user are "Register Nano Contract" and "Decline Transaction"
1. Click on "Decline Transaction" and then "No, Go Back"
1. Check that the user is still on the "Nano Contract Not Found" screen
1. Register the nano contract
1. Check the user is navigated to a validation screen containing the Nano Contract data and the betting information
1. Accept the transaction and see that the hotsite updates with the total amount bet on each option
1. Using another device, bet on the other option

### Set the bet result
1. On the HotSite click on "Set Result" and follow the instructions there
1. The wallet should open a screen asking to confirm the *Sign Oracle Request*, with:
  1. the oracle data unencrypted ( ex.: "Brazil Wins" )
  1. an option to show encrypted data ( ex.: "76a914db6fe378a8af070b332104c66c0a83dcb2d03e8b88ac" )
1. Accept the *Sign Oracle Request*
1. A new screen is shown requesting to confirm the transaction _Set Result Request*.
  1. This contains the blueprint method, caller address, value and raw signature
1. Accept request and validate that the transaction is successful

### Withdraw the prize
1. On the HotSite of the winning wallet session, click on "Collect your prize"
1. Confirm the wallet shows a transaction confirmation screen with the correct amount
1. Accept the transaction and check the wallet has received the correct amount

### Register tokens on Nano Contract send
The objective of this test is to try and send a custom token using a Nano Contract when the token is unregistered in the wallet, and check the flow to register it after the transaction. The suggested steps below are just one of the ways to test this.

1. Take note of the custom token UIDs created on the main QA tests
1. Unregister one of them from this wallet
1. Using a RPC source ( dApp or direct RPC calls ), initialize a Bet Blueprint with this custom token
1. Check that the request confirmation screen does not show the token name, just the UID, so no registration is offered
1. Now try to bet, depositing 1 unit of the custom token (you can unselect the "Push Tx" parameter to just experiment without sending tokens)
1. In the action list of the Request confirmation screen, check that the symbol of the custom token appears, with a tooltip to click on
1. Click the tooltip and check that the full token information is shown, with a "Tap to copy" link.
1. Confirm the transaction request
1. Check that a screen is displayed on transaction success asking the user if they want to register the unregistered tokens
1. Reject the registration and check the tokens are not registered
1. Send the custom tokens again using the Nano Contract
1. Accept the registration and check the tokens are registered

### Create a custom token
1. Using a RPC source ( dApp or direct RPC calls ), fill all mandatory fields to create a custom token
2. Check that the request confirmation screen shows all token information correctly
3. Confirm the transaction request and check the custom token now exists on the Explorer

#### External addresses and data output
1. Try again to create a custom token, but this time with:
  - No mint authority
  - A melt authority to an external address ( not from the wallet )
  - Make sure the "Allow External Melt Authority" is disabled
1. The request should appear correctly to the Mobile Wallet App
1. The "Allow External Melt Authority" option should be `false` in the request details
1. Confirm the transaction request
1. Check that the transaction fails
1. Try again to create the custom token, but this time enabling the "Allow External Melt Authority" option
1. Also add a data output with the string "Sample Data Output"
1. Confirm the transaction succeeds and that the token appears on the Explorer 
