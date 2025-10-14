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
