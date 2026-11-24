# Multi-chain (Hathor Next)

With the side chain connected, the wallet uses Hathor Network and Hathor Next at the same time: one token list, one Receive, one Send, and transfers of HTR from Hathor Network to Hathor Next.

Run these tests in order, on physical devices, with the version under test installed from the store. Two wallets are needed, on separate devices:
- **Wallet A**: a new wallet, where the tests are executed.
- **Wallet B**: a second wallet, already connected to Hathor Next, to pay and be paid.

### Test network
Use a public test network that has a side chain. It will probably be the **Hathor Next Devnet**, which is one of the options on Network Settings: no custom network is needed. The names, fees and confirmations on this document are from it.

Make sure the following feature flags are available for the test networks, including the one you switch from (e.g. Testnet).
1. `multichain.rollout`: everything about Hathor Next.
1. `multichain-network.rollout`: the Hathor Next Devnet option on Network Settings.
1. `multichain-token-create.rollout`: token creation on Hathor Next.

### Networks without a side chain
1. On Testnet, check that Settings has no "Connect to side chain", Receive has no chain selector and Send has no "Transfer between chains" button.
1. Change to Mainnet and check the same. Change back to Testnet.

### Select the test network
1. Navigate to Settings -> Network Settings and select "Hathor Next Devnet".
1. Check a success feedback modal appears, and the top bar says "Custom network: privatenet".
1. Check that Settings shows "Connect to side chain", turned off.
1. With the side chain off, paste wallet B's Hathor Next address on Send: Next stays disabled, and there is no "Transfer between chains" button.
1. Copy the Receive address and ask the development team for 30.00 HTR on it. Check that it arrives.

>[!NOTE]
> The Hathor Next Devnet has no Wallet Service and no Hathor Network explorer: the tests run on the Fullnode facade only, and the "Public Explorer" links lead nowhere.

### Connect to side chain
1. Turn on "Connect to side chain". Cancel the PIN screen: the switch stays off.
1. Turn it on with the phone in airplane mode and enter the PIN: "Couldn't connect to Hathor Next." shows, and the switch goes back to off.
1. Turn airplane mode off and repeat: "Connecting to Hathor Next…" shows, then the switch stays on.
1. Check the Dashboard: HTR is a single row with "2 chains" and a balance of 30.00. Any other token registered shows "Hathor Network".
1. Turn the switch off: the Dashboard goes back to Hathor Network only. Turn it on again: no PIN is required.
1. Kill and reopen the app. After the PIN, "Loading Hathor Next…" shows and the app opens with both chains, with no second PIN.

### Receive
1. Open Receive and check the "Hathor Network | Hathor Next" selector, with Hathor Network selected and its screen unchanged.
1. Select Hathor Next: the address starts with `samba1z`, and there is no "New address" button.
1. Copy the address, share it and scan its QR code: the three are the same.
1. Leave the screen and come back: Hathor Network is selected again.

### Transfer screen
1. On Send, tap "Transfer between chains". Check it goes from Hathor Network to Hathor Next, with the HTR available.
1. Tap the ⇅ button: "Transfers from Hathor Next to Hathor Network aren't available yet."
1. Type a random text as the address and any amount, and tap Continue: "Invalid address".
1. Type a Hathor Network address: "This is a Hathor Network address. Enter a Hathor Next address."
1. Tap "Use my Hathor Next address": the field shows the same address as Receive.
1. Paste `1,2.3` as the amount: "Use only one decimal separator."
1. Type the whole balance and tap Continue: "Insufficient funds", since the network fee of 0.01 HTR doesn't fit.
1. Type 10.00: You'll receive 10.00 HTR, Bridge fee 0.00 HTR, Network fee 0.01 HTR, Arrives in about 2 minutes, and the one-way warning shows.

### Transfer to my address
1. Tap Continue. Check the confirmation has the same values, and "To your address".
1. Tap "Confirm and send", miss the PIN once, then type the correct one.
1. Check "Your HTR will arrive on Hathor Next in about 2 minutes." and tap Done: the Dashboard shows.
1. Check the HTR row on the Dashboard: "2 chains · 10.00 arriving", with a balance of 29.99.
1. Open HTR and tap the "Moved to Hathor Next" row. Step 1 is Done, with its transaction ID. Step 2 shows "Confirming … of 21 on Hathor Network".
1. Kill and reopen the app before it arrives: the transfer continues from where it was.
1. After it arrives, check that "arriving" disappears, step 2 is Done and the balance is still 29.99.

### Transfer to another wallet
1. Transfer 2.00 HTR to wallet B's Hathor Next address. The confirmation shows "To", and not "To your address".
1. Check that the balance drops 2.01, and the row says "Transferred to Hathor Next".
1. Check that wallet B receives 2.00 HTR.

### Create a token on Hathor Next
1. Go to Settings -> "Create a token on Hathor Next".
1. Type `Hathor` as the name: the native token's name is refused. Change it to `QA Token`.
1. Type one letter as the symbol, then `Q$`: each one shows its own error. Change it to `QAT`.
1. Type 100 as the amount. Check the network fee of 0.05 HTR and the two notes: the creation is public, and the token's keys come from the recovery words.
1. Tap Next, then "Create token" and enter the PIN. A warning icon shows with "Your change of … HTR will be public."
1. Tap Cancel: "The token wasn't created. Nothing was signed and no fee was paid."
1. Create it again, now tapping "Create QAT": check the success message with the token id.
1. Check the Dashboard: `QA Token` followed by the start of its id, 100.00 and "Hathor Next".
1. Open it and check the full token id, which can be copied.
1. Create another token with the same name and symbol: both are listed, told apart by their ids.

### Payments that would be public
Until this point, all the HTR wallet A has on Hathor Next is public (it came from a transfer or from a token creation's change).
1. Send to wallet B all the HTR of Hathor Next minus the 0.05 fee. After the PIN, a warning icon shows with "Sending all of these funds would make the amount public on Hathor Next…"
1. Tap "Change amount": the amount step shows, with the address and the amount kept. Go back without sending.
1. Send 5 QAT to wallet B: it is refused with "The network fee would come from HTR whose amount is already public…"
1. Tap Done and check the Dashboard shows, and the balances did not change.

### Send HTR on Hathor Next
1. On Send, paste a Hathor Network address: "Hathor Network" shows under it. Replace it with wallet A's own Hathor Next address: "Hathor Next" shows instead.
1. Send 0.10 HTR to it. Check the amount step shows the available balance and "Network fee: 0.05 HTR".
1. Check the confirmation: Amount, Address, Network fee, a Total of 0.15 HTR, and the "Private" note.
1. Tap Send, miss the PIN once, then type the correct one. Check "Settled and irreversible." and tap Done.
1. Open Send again: it starts at an empty address input. Only 0.05 HTR left the balance.
1. Send 1.00 HTR to wallet B. Check that wallet B receives it without a reload.
1. Send 1.00 HTR from wallet B to wallet A: the balance updates without a reload.

### Send a custom token on Hathor Next
1. On Send, enter wallet B's Hathor Next address and tap the token box. The list shows HTR and both QAT tokens, with their balances and ids.
1. Select a QAT token: the title changes to "SEND QAT", and the network fee is still in HTR.
1. Send 5 QAT. Check the confirmation shows the token id and no Total.
1. Check that wallet B lists the token without registering it, with a balance of 5.00.
1. Check that QAT is 95.00 and HTR dropped 0.05.

### Insufficient balance on one chain
1. Send to wallet B's Hathor Next address an amount that only Hathor Network has: "You have … HTR on Hathor Next. Send from Hathor Network instead? It arrives in about 2 minutes."
1. Tap "Transfer between chains": the transfer opens with wallet B's address and the amount filled in.
1. Go back and type an amount that only both chains together have: it shows both balances and "Transfer the rest to Hathor Next first." The transfer opens with wallet A's own address and the missing amount.
1. Type more than both chains have: "Insufficient funds".
1. Send to a Hathor Network address an amount that only Hathor Next has: "Transfers from Hathor Next to Hathor Network aren't available yet." Transfer more HTR to Hathor Next before, if needed.

### QR codes and the transfer address
1. Scan wallet B's Hathor Next address with the Dashboard's scanner: Send opens with it filled in.
1. Go on to the amount step, return to the Dashboard and scan it again: Send is back on the address step, with the address.
1. Scan it with the scanner of the Send screen: the address is filled in.
1. Create a QR code with the text `samba:<wallet B's address>?amount=1`, on any QR code generator. Scan it with both scanners: each one says that payment request QR codes are not supported.
1. Type `WScTqhLsBQnz3HMdQqh66JBgWqb255XffL` on Send: "This address is only for transfers to Hathor Next…" and Next stays disabled.

### HTR history
1. Open HTR. The "All chains" chip is selected, the rows are ordered from newest to oldest, and each transaction shows its chain.
1. Check that each transfer is a single row. The one to wallet A says "10.00 HTR moved · 0.01 fee".
1. Tap the chip: each option shows its balance, and the balances of the two chains add up to All chains.
1. Select Hathor Network: the same transfer is "Transferred to Hathor Next", -10.01.
1. Select Hathor Next: it is "Transfer from Hathor Network", 10.00. The payment to wallet B is two rows, "Sent to samba1…" and "Fee".
1. Tap a Hathor Next payment: check Status "Settled", Date, Address and Transaction ID.
1. Kill and reopen the app: the row now says only "Sent", since the recipient isn't stored.

### Offline and failed load
1. On the Hathor Next amount step, turn on airplane mode: "No internet connection" shows and Next is disabled. Turn it off: Next is enabled again.
1. Set the phone's clock 10 minutes ahead, kill and reopen the app: it says that the phone's date and time are off.
1. Tap "Reset wallet", go back without resetting and enter the PIN: the same screen shows.
1. Fix the clock and tap "Try again": the app opens with both chains.
1. Repeat with the wrong clock, now tapping "Disconnect side chain": the app opens on Hathor Network only. Fix the clock and connect again.

### Lock, PIN and biometry
1. Keep the app in the background for more than 30 seconds and unlock it: both chains show, and a send on Hathor Next works.
1. Change the PIN, then kill and reopen the app: Hathor Next loads with the new PIN.
1. Enable biometry: the app start, a send on Hathor Next, a transfer and a token creation ask for it.

### Hathor Network features
With the side chain connected, check these still work on Hathor Network:
1. Send HTR and a custom token to a Hathor Network address.
1. Create, unregister and register a token. Its row on the Dashboard shows "Hathor Network".
1. Change the Address Mode: after the reload, both chains show.

### Network and wallet changes
1. Change to Testnet: nothing of Hathor Next shows.
1. Still on Testnet, have a dApp connected through [Reown](QA_REOWN.md) request a `htr_sendTransaction` to `WScTqhLsBQnz3HMdQqh66JBgWqb255XffL`: the request is refused, with no confirmation.
1. Change back to the Hathor Next Devnet: both chains show, with no need to connect again.
1. Reset the wallet and create a new one on the same network: "Connect to side chain" is off, and there are no Hathor Next tokens.
1. Reset and import wallet A's words. Connect the side chain: the Hathor Next address, the balances, the QAT tokens and the history are the same as before.
1. Create another token: it is created, with a new id.

### Passkey wallet
1. Make sure the `passkey-onboarding.rollout` flag is available too. On wallet B's device, reset the wallet and create a passkey wallet on the same network.
1. Turn on "Connect to side chain" and dismiss the passkey: the switch stays off, with no error. Repeat, completing it.
1. Kill and reopen the app: a single passkey request loads both chains.
1. Send it 5.00 HTR on Hathor Network from wallet A, and transfer 3.00 HTR to its own Hathor Next address. Dismiss the passkey on the first attempt: nothing is sent. Repeat, completing it.
1. Send HTR on Hathor Next and dismiss the passkey: nothing is sent, and Send is enabled. Repeat, completing it.
1. Do the same for a token creation.
