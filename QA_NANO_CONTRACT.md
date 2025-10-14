# QA Nano Contract

- CTA: call-to-action

### Hidden tab when disabled
- Make sure the nano-contract feature is 🚫**disabled** for the device
- Check a toggle button with two options **does not appear** in the dashboard head
	- Tokens
	- Nano

### Activation
- Make sure the **wallet-service** feature is 🚫**disabled** for the device
- Make sure the **nano-contract** feature is ✅**enabled** for the device
- Make sure to connect to a network that supports Nano Contracts, like `testnet-hotel` or `nano-testnet`
- Check a toggle button with two options appear in the dashboard head
	- Tokens
	- Nano

### Nano Contract Details
- Check the option "Tokens" is selected
- Select the option "Nano Contracts"
- Check the Nano Contract component is in focus with a title "No Nano Contracts"
- Check the *Nano Contract Details* component has:
	- a message, and
	- a call-to-action (CTA) "Register new"

### Register Nano Contract
- Register a new Nano Contract by tapping over "Register new" on *Nano Contract Details*
	- It may focus on a component of loading
- Check the Nano Contract Registration screen contains:
  - a Nano Contract ID input
  - a Wallet Address loaded
  - a disabled "REGISTER NANO CONTRACT" button
- Try to register an invalid Nano Contract ID ( ex.: use the id for a common transaction or a random 64-char string )
- Check for a failure feedback modal to appear and dismiss it
- Clear the input and check if a validation error message appeared under it
- Check if the "REGISTER NANO CONTRACT" button is disabled
- Type any input and check if the error messages disappeared and the button is enabled

### Register Nano Contract using the right network
- Click the "Nano Contracts" tab on the dashboard
- Tap on "Register new" and type a valid Nano Contract ID for the current network
  - You can check "Nano" tab in the Explorer for the connected network for valid Nano Contract IDs
  - For `testnet-hotel` network, you can use the Nano Contract ID `00004c19c4d78758d23da6dd0722c1e9cda7526c0cc4fa4438e932f4ec8e64c6`
- Tap on "REGISTER NANO CONTRACT" button
- Check for a success feedback modal to appear
	- If a failure feedback modal appear with the message "The informed address does not belong to the wallet", this may indicate a problem with the backend, especially the Wallet Service. In this case, please report the issue to the development team for further investigation.
- Check the feedback modal has:
	- A message informing the registration was successful
	- A "SEE CONTRACT" button
- Tap on "SEE CONTRACT" button and check that the *Nano Contract Details* screen is in focus

### Inspect Nano Contract Details
- Ensure you are in the *Nano Contract Details* screen
- Check there is at least one transaction listed, the "initialize"
- Tap multiple times on "Nano Contract" header to expand and hide it
- With this section expanded, check it has the fields:
  - Nano contract ID, with eclipsed value
  - Contract name
  - Registered address
- Check the field "Registered Address" is clickable and shows a modal
- Dismiss this modal and, back to the details screen check there are two CTAs side-by-side:
	- "See status details"
	- "Unregister contract"
- Tap on "See status details" CTA:
	- A browser app should open in the explorer page of the Nano Contract and it should contain all Nano Contract details
- Go back to the wallet and tap on "Registered Address"
- Check for a "Choose New Wallet Address" modal appears
- Check the address of *index 0* is selected. Select any other.
- The "New Nano Contract Address" modal shown has:
	- An information content informing user this address is used to sign a transaction within the Nano Contract
	- A mirror content informing the selected address and its index
	- Confirmation and cancellation buttons
- Tap on "GO BACK" button and check the modal is dismissed
- Select any other indexed address and confirm the selection
- Check for the new address is set on "Registered Address" field
- Tap on "Registered Address" and check the correct address is selected
- Dismiss the modal and tap on "Unregister contract" CTA
- Check for a new "Unregister Nano Contract" modal appear
- Cancel the action and check it dismisses the modal
- Tap on "Unregister contract" and confirm the action
- Check the *Dashboard* screen is on focus
- Check the Nano Contract list is empty
	- It shows title "No Nano Contracts"

### Inspect Nano Contract Transaction
- Register a valid Nano Contract with many transaction such as `000014d0b810bde1e598a311e4229cfc74690be03acb4181e5efd74e763153ff`
- Go the *Nano Contract Details* screen
- Check there are many transactions
- Check a transaction item has:
	- An eclipsed Transaction ID value in bold format
	- A method name for the transaction
	- A humanized timestamp
- Check any item is actionable
- Check the transaction list is ordered from newest to oldest
- Check the oldest transaction is the `initialize`. Tap it.
- Check the *Nano Contract Transaction* screen is on focus. Validate its fields:
  - a "Transaction ID" field with eclipsed value as a header
  - an expanded header
  - a label with value "Executed" in green
  - a "Transaction ID" field with eclipsed value
  - a "Nano Contract ID" field with eclipsed value
  - a "Blueprint Method" field and value
  - Check there ia a "Date and Time" field and value
  - a "Caller" field with eclipsed value
  - a "See transaction details" CTA
- Tap on "See transaction details" CTA
  - A browser app should open in the explorer page of the Transaction
- Go back to the wallet and tap on any area of the header to shrink it
- Check there is a content area under the header with title "No Actions"
- Go back to *Nano Contract Details* screen and select another action
- Check there is an action as a content that has:
	- A description of the action
	- An Input ID with eclipsed value, if it's a deposit or withdrawal
	- An action amount

### Change network and reset registered Nano Contracts
- Switch to the `mainnet` network
- If it has a "Nano Contracts" tab, select it. If not, switch back to `testnet-hotel`
- Check there is no Nano Contract registered

## Reown tests

### Connect to a dApp using ReOwn
- Open the Hathor Network [Bet dApp hotsite](https://staging.betting.hathor.network/)
- Start the process to connect your wallet using the WalletConnect/ReOwn option
- Reject the connection and check the hotsite just closes the QR Code modal
- Start again but this time connect your wallet
- Check the Bet dApp is now connected to your wallet through the "Hathor Bet" ReOwn session on the Wallet

### Create a Bet nano contract
- On the Bet dApp hotsite, create a simple Bet nano contract with:
  - Random results
  - Two different possible outcomes
- A screen should be opened on the wallet to confirm the creation of the Bet nano contract
  - Check that the screen has all the information about the nano contract
    - Blueprint Id
    - Contract name
    - Method "initialize"
    - Caller address ( actionable )
    - Argument "oracle_script"
    - Argument "token_uid" as HTR
    - Date last bet in a human readable date and time
- Click "Decline Transaction" and then "No, Go Back"
- Check that the user is still on the reviewing screen
- Click "Decline Transaction" and then confirm. Check the wallet navigates to the Dashboard
- The hotsite displays an error during confirmation message
- Try again and this time confirm the contract creation
- The hotsite should display a message about waiting for block confirmation
- After a while, the hotsite should display the success message and a CTA to create a bet

### Create a Bet
- On the Bet dApp hotsite, create a simple Bet with 1 HTR and one of the options
- The wallet should open a screen about a nano contract not found
- The options for the user are "Register Nano Contract" and "Decline Transaction"
- Click on "Decline Transaction" and then "No, Go Back"
- Check that the user is still on the "Nano Contract Not Found" screen
- Register the nano contract
- Check the user is navigated to a validation screen containing the Nano Contract data and the betting information
- Accept the transaction and see that the hotsite updates with the total amount bet on each option
- Using another device, bet on the other option

### Set the bet result
- On the HotSite click on "Set Result" and follow the instructions there
- The wallet should open a screen asking to confirm the *request*, with:
  - the oracle data unencrypted ( ex.: "Brazil Wins" )
  - an option to show encrypted data ( ex.: "76a914db6fe378a8af070b332104c66c0a83dcb2d03e8b88ac" )
- Accept the *request*
- A new screen is shown asking to confirm the transaction
  - This contains the blueprint method, caller address, value and raw signature
- Accept the transaction

### Withdraw the prize
- On the HotSite of the winning wallet session, click on "Collect your prize"
- Confirm the wallet shows a transaction confirmation screen with the correct amount
- Accept the transaction and check the wallet has received the correct amount

### Register tokens on Nano Contract send
( This test is pending a better description on how to create its scenario )
- Using Reown, create a Nano Contract that holds some custom tokens
- Unregister the custom tokens from this wallet
- Send those custom tokens using the Nano Contract
- Check that a screen is displayed on transaction success asking the user if they want to register the unregistered tokens
- Reject the registration and check the tokens are not registered
- Send the custom tokens again using the Nano Contract
- Accept the registration and check the tokens are registered

