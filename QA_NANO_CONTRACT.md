# QA Nano Contract

- CTA: call-to-action

### Activation
- [ ] Make sure the wallet-service is disabled for the device
- [ ] Enable the nano contract feature for the device
- Close the wallet and reopen
- [ ] Check a toggle button with two options appear in the dashboard head
	- Tokens
	- Nano

### Nano Contract Details
- [ ] Check the option "Tokens" is selected
- Select the option "Nano Contracts"
- [ ] Check the Nano Contract component is in focus with a title "No Nano Contracts"
- [ ] Check the *Nano Contract Details* component has:
	- a message, and
	- a call-to-action (CTA) "Register new"

### Register Nano Contract
- Register a new Nano Contract by tapping over "Register new" on *Nano Contract Details*
	- It may focus on a component of loading
- [ ] Check if the Nano Contract Registration screen is in focus
- [ ] Check if the Nano Contract ID is an input
- [ ] Check if the Wallet Address is loaded
- [ ] Check if the "REGISTER NANO CONTRACT" button is disabled
- Type the following Nano Contract ID `00004f1a3b07f0ffc7ced77a19ae6d4407991a15a281c0ddaf3d6e04a56eba78`
	- It represents a Nano Contract in the `nano-testnet` network
- [ ] Check the "REGISTER NANO CONTRACT" button is now actionable
- Tap on "REGISTER NANO CONTRACT" button
- [ ] Check for a failure feedback modal to appear
	- You can't register a Nano Contract from another network
	- If the message "The informed address does not belong to the wallet" is the failure message, it happens when you are using the wallet service. Make sure to disable it and reload the wallet.
- Dismiss the modal by tapping outside its area
- Remove the input
- [ ] Check if a validation message of error appeared under the input:
	- It should informe the field is required
	- it should be in color red
- [ ] Check if the "REGISTER NANO CONTRACT" button is disabled
- Type any input
- [ ] Check if the validation error message disappeared

### Change network
- Navigate to the *Settings* screen
- Go to "Network Settings" > Understand disclaimer > Customize
- [ ] Check if the following fields are hidden, you should not be able see them if Wallet Service is disabled:
	- "Wallet Service URL (optional)", and
	- "Wallet Service WS URL (optional)"
- [NOTE] If you see the mentioned fields because you have Wallet Service enabled, check they are empty or do it by your own before following the next instructions.
- Set "Node URL" the input "https://node1.nano-testnet.hathor.network/v1a/"
- Set "Explorer URL" the input "https://explorer.alpha.nano-testnet.hathor.network/"
- Set "Explorer Service URL" the input "https://explorer-service.nano-testnet.hathor.network/"
- Set "Transaction Mining Service URL" the input "https://txmining.nano-testnet.hathor.network/"
- Tap on "SEND" button
- [ ] Check for a success feedback modal message
- Dismiss the feedback modal
- [ ] Check there is a yellow bar at the head informing the custom network as *testnet*
- Go back to *Dashboard* screen

### Register Nano Contract using the right network
- Select the option "Nano Contracts" of the toggle button
- Tap on "Register new" CTA
- Type `00004f1a3b07f0ffc7ced77a19ae6d4407991a15a281c0ddaf3d6e04a56eba78` as input to Nano Contract ID
- Tap on "REGISTER NANO CONTRACT" button
- [ ] Check for a success feedback modal to appear
	- If a failure feedback modal appear with the message "The informed address does not belong to the wallet", it happens when you are using the wallet service. Make sure to disable it and reload the wallet
- [ ] Check the feedback modal has:
	- A message informing the registration has happen with success, and
	- A "SEE CONTRACT" button
- Tap on "SEE CONTRACT" button
- [ ] Check *Nano Contract Details* screen is in focus

### Inspect Nano Contract Details
- From the *Nano Contract Details* screen follow the instructions
- [ ] Check there is at least one transaction listed, the "initialize"
- Tap on "Nano Contract" header to expand it
- Tap on "Nano Contract" header again to shrink it
- Tap on "Nano Contract" header to expand it again
- [ ] Check there is a "Nano Contract ID" field with eclipsed value
- [ ] Check there is a "Blueprint Name" field and value
- [ ] Check there ia a "Registered Address" field and value
- [ ] Check the field "Registered Address" is actionable
- [ ] Check there are two CTAs side-by-side:
	- "See status details", and
	- "Unregister contract"
- Tap on "See status details" CTA:
	- A browser app should open in the explorer page of the Nano Contract and it should contains all Nano Contract details information, including the arguments of the method call
- Go back to the wallet
- Tap on "Registered Address"
- [ ] Check for a "Choose New Wallet Address" modal appears
- [ ] Check the address of *index 0* is selected
- Select any other indexed address
- [ ] Check for a "New Nano Contract Address" modal appears
- [ ] Check "New Nano Contract Address" modal has:
	- An information content informing user this address is used to sign a transaction within the Nano Contract
	- A mirror content informing the selected address and its index
	- A "CONFIRM NEW ADDRESS" button
	- A "GO BACK" button
- Tap on "GO BACK" button
- [ ] Check the modal disappear
- Select any other indexed address
- [ ] Check the modal appear
- Tap outside modal area
- [ ] Check the modal disappear
- Select any other indexed address
- Tap on "CONFIRM NEW ADDRESS"
- [ ] Check for the new address is set on "Registered Address" field
- Tap on "Registered Address"
- [ ] Check for the correct indexed address is selected
- [ ] Dismiss the modal
- Tap on "Unregister contract" CTA
- [ ] Check for a new "Unregister Nano Contract" modal appear
- [ ] Check "Unregister Nano Contract" modal has:
	- A message asking the user to be sure of unregistration,
	- A button "YES, UNREGISTER CONTRACT", and
	- A button "NO, GO BACK"
- Tap on "NO, GO BACK" button
- [ ] Check the modal disappear
- Tap on "Unregister contract" CTA again
- Tap on "YES, UNREGISTER CONTRACT"
- [ ] Check the *Dashboard* screen is on focus
- [ ] Check the Nano Contract list is empty
	- It shows title "No Nano Contracts"

### Inspect Nano Contract Transaction
- [ ] Register the Nano Contract `00004f1a3b07f0ffc7ced77a19ae6d4407991a15a281c0ddaf3d6e04a56eba78`
- Go the *Nano Contract Details* screen
- [ ] Check there are many transactions
- [ ] Check a transaction item has:
	- An eclipsed Transaction ID value in bold format
	- A method name for the transaction
	- A humanized timestamp
- [ ] Check any item is actionable
- [ ] Check the transaction list is ordered from newest to oldest
- [ ] Check the oldest transaction is the `initialize`
- Tap on `initialize` transaction
- [ ] Check the *Nano Contract Transaction* screen is on focus
- [ ] Check there is a "Transaction ID" field with eclipsed value as a header
- [ ] Check the header is expanded
- [ ] Check there is a label with value "Executed" in green
- [ ] Check there is a "Transaction ID" field with eclipsed value
- [ ] Check there is a "Nano Contract ID" field with eclipsed value
- [ ] Check there is a "Blueprint Method" field and value
- [ ] Check there ia a "Date and Time" field and value
- [ ] Check there is a "Caller" field with eclipsed value
- [ ] Check there is a "See transaction details" CTA
- Tap on any area of the header to shrink it
- Tap on "Transaction ID" header to expand it
- Tap on "See transaction details" CTA
	- A browser app should open in the explorer page of the Transaction and it should contains all Transaction details information, including the arguments of the method call
- Go back to the wallet
- [ ] Check there is a content area under the header with title "No Actions"
- Go back to *Nano Contract Details* screen
- Tap on any bet
- [ ] Check the *Nano Contract Transaction* screen is on focus
- [ ] Check there is an action as a content that has:
	- A "Deposit" text prefix
	- An Input ID with eclipsed value
	- An action amount

### Change network and reset registered Nano Contracts
- Go to *Network Settings* screen
- Customize it to `testnet` network
- Go back to *Dashboard* screen
- Select "Nano Contracts" option if not selected
- [ ] Check there is no Nano Contract registered
- Customize network to `nano-testnet` network
- Set "Node URL" to value `https://node1.nano-testnet.hathor.network/v1a/`
- Set "Transaction Mining Service URL" to value `https://txmining.nano-testnet.hathor.network/`
- Clean "Wallet Service URL (optional)" and "Wallet Service WS URL (optional)" if present
- Tap on "SEND"
- Go back to *Dashboard* screen
- Select "Nano Contracts" option if not selected
- [ ] Check there is no Nano Contract registered
