# Token Swap

1. **Token swap screen**
	1. [ ] Open the token swap screen via the bottom menu
    1. If the :arrows_clockwise: icon is not present then enable the feature flag `token-swap.rollout` for your device.
	1. [ ] Check that HTR is already selected as the top token and the bottom token is already selected.
  1. [ ] Check that both amounts should be set to 0.00

1. **Token Selection**
  1. [ ] Click on either token box to select another token
    1. A list of tokens and balances should be shown
  1. [ ] Close this screen and send some HTR to your wallet
  1. [ ] Check that the HTR balance shows correctly on this screen

1. **Token swap quote**
  1. [ ] Clicking on the :arrows_clockwise: icon between the tokens should switch the top and bottom tokens.
  1. [ ] Add 1.00 HTR on the top input and click outside the input area.
    1. The bottom value should be filled out and in gray tone.
  1. [ ] Check the swap quote information
    1. Conversion rate should match the input/output amounts
    1. Slippage should be 0.5%
    1. Price impact should be a percentage
    1. Minimum received should be a value lower than the output (bottom) amount
  1. [ ] This time add 1.00 hUSDC on the bottom input area
    1. The top value should be filled out and in gray tone.
  1. [ ] Check the swap quote information
    1. Conversion rate should match the input/output amounts
    1. Slippage should be 0.5%
    1. Price impact should be a percentage
    1. Maximum to deposit should be a value higher than the input (top) amount

1. **Switching tokens**
  1. [ ] Clicking on the token switch buttom (the :arrows_clockwise: icon between the tokens) should switch the top and bottom tokens.
    1. The input amounts should be cleared when switching tokens
  1. [ ] With the top token selected as HTR and the bottom as hUSDC click on the "HTR token box"
    1. Select hUSDC from the list
  1. [ ] Check that the top token is hUSDC and the bottom token is HTR.

1. **Token Swap review**
  1. [ ] Write a swap of 5.00 HTR for hUSDC
    1. [ ] Check the output value
  1. [ ] The "Review" buttom should be enabled, click it
  1. [ ] The swap should read the same values as the last screen
  1. [ ] The "Swap Details" section should match the values from the last screen
  1. [ ] Click on the :arrow_backward: icon (or "Go Back" buttom) at the top left of the screen.
    1. The main screen should appear, going back to the token swap screen should show an empty swap. 
  1. [ ] Enter the same swap details but this time click on the "Swap" buttom at the end.
  1. [ ] The token swap should be completed correctly
  1. [ ] Check the transaction on the HTR tx history
  1. [ ] Go back to the token swap screen, select the token box to open the list of tokens.
  1. [ ] There should be some balance for the hUSDC token.
 
