/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ncApi } from '@hathor/wallet-lib';
import { get } from 'lodash';

/**
 * Definition of a swap step.
 * Multiple swap steps will configure the token swap path.
 *
 * @typedef {Object} TokenSwapPathStep
 * @property {string} tokenIn Token being traded in
 * @property {string} tokenOut Token being traded out
 * @property {number} fee Fee charged for this swap
 */

/**
 * @typedef {Object} TokenSwapQuote
 * @property {TokenSwapPathStep[]} path Path the token swap will take.
 * @property {string} pathStr Value returned by the contract before parsing.
 * @property {number[]} amounts Value of the swap at each step.
 * @property {number} amount Amount to be withdrawn or deposited, depending on the direction.
 * @property {number} price_impact percentage value of how the swap will affect the price (with precision).
 */

/**
 * Parse a quote path step from the string value.
 * @param {string} pathStep
 * @returns {TokenSwapPathStep}
 */
function parseQuotePathStep(pathStep) {
  const step = pathStep.split('/');
  step[2] = Number(step[2]);
  return {
    tokenIn: step[0],
    tokenOut: step[1],
    fee: Number(step[2]),
  };
}

/**
 * Fetch the token swap information for the proposed swap.
 * The swap being proposed will deposit `amount` of `tokenIn` to the `contractId`.
 * This method will find the best path and value of `tokenOut` we can withdraw given the amount deposited.
 *
 * @param {string} contractId The pool manager to find the swap
 * @param {bigint} amount Amount to withdraw from the contract
 * @param {string} tokenIn Token UID of the deposited token
 * @param {string} tokenOut Token UID of the withdrawn token
 * @returns {Promise<TokenSwapQuote>}
 */
async function findBestTokenSwapPathIn(contractId, amount, tokenIn, tokenOut) {
  const call = `find_best_swap_path(${amount},"${tokenIn}","${tokenOut}",3)`;

  const response = await ncApi.getNanoContractState(contractId, [], [], [call]);

  if (!(response.calls && response.calls[call])) {
    throw new Error('Did not receive any return data');
  }
  const data = response.calls[call];
  return {
    path: data.path.split(',').map(step => parseQuotePathStep(step)),
    pathStr: data.path,
    amounts: data.amounts,
    amount: data.amount_out,
    price_impact: data.price_impact,
  };
}

/**
 * Fetch the token swap information for the proposed swap.
 * The swap being proposed will withdraw `amount` of `tokenOut` from the `contractId`.
 * This method will find the best path and value to deposit of `tokenIn` to make it happen.
 *
 * @param {string} contractId The pool manager to find the swap
 * @param {bigint} amount Amount to withdraw from the contract
 * @param {string} tokenIn Token UID of the deposited token
 * @param {string} tokenOut Token UID of the withdrawn token
 * @returns {Promise<TokenSwapQuote>}
 */
async function findBestTokenSwapPathOut(contractId, amount, tokenIn, tokenOut) {
  const call = `find_best_swap_path_exact_output(${amount},"${tokenIn}","${tokenOut}",3)`;

  const response = await ncApi.getNanoContractState(contractId, [], [], [call]);

  if (!(response.calls && response.calls[call])) {
    throw new Error('Did not receive any return data');
  }
  const data = response.calls[call];
  return {
    path: data.path.map(step => parseQuotePathStep(step)),
    amounts: data.amounts,
    amount: data.amount_in,
    price_impact: data.price_impact,
  };
}

/**
 * Build the NanoContractAction array required to call the token swap method.
 *
 * @param {'input'|'output'} direction Direction of the swap
 * @param {TokenSwapQuote} quote Token swap quote
 * @param {bigint} amount Amount to swap, may be the input or output amount depending on the direction
 * @param {string} tokenIn Token UID of the deposited token
 * @param {string} tokenOut Token UID of the withdrawn token
 * @param {number} slippage
 */
function buildTokenSwapActions(direction, quote, amount, tokenIn, tokenOut, slippage) {
  const actions = [];
  if (direction === 'input') {
    actions.push({
      type: 'deposit',
      token: tokenIn,
      amount,
    });
    // Withdraw amount minus slippage
    actions.push({
      type: 'withdrawal',
      token: tokenOut,
      amount: quote.amount * (1 - (slippage/100)),
    });
  } else if (direction === 'output') {
    actions.push({
      type: 'withdrawal',
      token: tokenOut,
      amount,
    });
    // Deposit amount plus slippage
    actions.push({
      type: 'deposit',
      token: tokenIn,
      amount: quote.amount * (1 + (slippage/100)),
    });
  } else {
    throw new Error('Unknown token swap direction');
  }

  return actions;
}

/**
 * Get the correct swap method on the dozer protocol to execute based on the arguments given.
 *
 * @param {'input'|'output'} direction Direction of the swap
 * @param {TokenSwapQuote} quote Token swap quote
 */
function getTokenSwapMethod(direction, quote) {
  const methods = {
    'input': {
      'single': 'swap_exact_tokens_for_tokens',
      'multi': 'swap_exact_tokens_for_tokens_through_path',
    },
    'output': {
      'single': 'swap_tokens_for_exact_tokens',
      'multi': 'swap_tokens_for_exact_tokens_through_path',
    },
  };

  if (quote.path.length === 0) {
    throw new Error('Path cannot have zero length');
  }
  
  const pathN = quote.path.length > 1 ? 'multi' : 'single';
  const method = get(methods, `${direction}.${pathN}`, null);
  if (method === null) {
    throw new Error('Could not determine which method to call.');
  }
  return method;
}

/**
 * Fetch the token swap information for the proposed swap.
 * If `direction` is 'input' then `amount` is the value to be deposited on the swap.
 * If `direction` is 'output' then `amount` is the value to be withdrawn from the swap.
 *
 * @param {'input'|'output'} direction Direction of the swap
 * @param {string} contractId The pool manager to find the swap
 * @param {bigint} amount Amount to swap, may be the input or output amount depending on the direction
 * @param {string} tokenIn Token UID of the deposited token
 * @param {string} tokenOut Token UID of the withdrawn token
 * @returns {TokenSwapQuote}
 */
export async function findBestTokenSwap(direction, contractId, amount, tokenIn, tokenOut) {
  if (direction === 'input') {
    return await findBestTokenSwapPathIn(contractId, amount, tokenIn, tokenOut);
  } else if (direction === 'output') {
    return await findBestTokenSwapPathOut(contractId, amount, tokenIn, tokenOut);
  } else {
    throw new Error('Unknown token swap direction');
  }
}

/**
 * Create a SendTransaction instance to execute the swap method call.
 * Will determine the correct swap method to execute and mount the data accordingly.
 *
 * @param {import('@hathor/wallet-lib').HathorWallet} wallet
 * @param {string} address Address that will send the tx
 * @param {'input'|'output'} direction Direction of the swap
 * @param {string} contractId The pool manager to find the swap
 * @param {TokenSwapQuote} quote Token swap quote
 * @param {bigint} amount Amount to swap, may be the input or output amount depending on the direction
 * @param {string} tokenIn Token UID of the deposited token
 * @param {string} tokenOut Token UID of the withdrawn token
 * @param {number} slippage
 * @returns {Promise<SendTransaction>}
 */
export async function executeTokenSwap(wallet, address, direction, contractId, quote, amount, tokenIn, tokenOut, slippage) {
  const actions = buildTokenSwapActions(wallet, direction, quote, amount, tokenIn, tokenOut, slippage);
  const data = {
    ncId: contractId,
    actions,
    args: [],
  };
  const method = getTokenSwapMethod(direction, quote);
  if (quote.path.length > 1) {
    // The methods for multi stage paths expect the path string as argument
    data.args.push(quote.pathStr);
  } else {
    // The methods for single stage path expect the pool fee as argument
    data.args.push(quote.path[0].fee);
  }

  // Call `method` signed by `address` with the prepared `data`
  // XXX: should pinCode be another argument?
  // or should we have 1 method to build the data and the wallet call can be done in the screen?
  return await wallet.createNanoContractTransaction(method, address, data, { pinCode: '1234' });
}
