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
 * Parsed token swap quote.
 *
 * @typedef {Object} TokenSwapQuote
 * @property {'input'|'output'} direction If the user decided the deposit (input) or withdraw (output) amount.
 * @property {TokenSwapPathStep[]} path Path the token swap will take.
 * @property {string} pathStr Value returned by the contract before parsing.
 * @property {number[]} amounts Value of the swap at each step.
 * @property {number} amount_in Amount to deposited.
 * @property {number} amount_out Amount to be withdrawn.
 * @property {number} price_impact percentage value of how the swap will affect the price (with precision).
 */

/**
 * Error class for issues during token swap validation or execution.
 * All token swap errors will derive from this.
 */
export class TokenSwapError extends Error {}

export class TokenSwapPathError extends TokenSwapError {
  constructor() {
    super('Path cannot have zero length');
  }
}

export class TokenSwapMethodError extends TokenSwapError {
  constructor() {
    super('Could not determine which method to call.');
  }
}

export class TokenSwapCallError extends TokenSwapError {
  constructor() {
    super('Call to token swap method was invalid.');
  }
}

export class TokenSwapDirectionError extends TokenSwapError {
  constructor() {
    super('Unknown token swap direction');
  }
}

/**
 * Parse a quote path step from the string value.
 * @param {string} pathStep
 * @returns {TokenSwapPathStep}
 */
function parseQuotePathStep(pathStep) {
  const step = pathStep.split('/');
  return {
    tokenIn: step[0],
    tokenOut: step[1],
    fee: Number(step[2]),
  };
}

/**
 * Build the NanoContractAction array required to call the token swap method.
 *
 * @param {TokenSwapQuote} quote Token swap quote
 * @param {string} tokenIn Token UID of the deposited token
 * @param {string} tokenOut Token UID of the withdrawn token
 * @param {number} slippage
 */
function buildTokenSwapActions(quote, tokenIn, tokenOut, slippage) {
  const actions = [];
  if (quote.direction === 'input') {
    /**
     * For input direction the deposit (amount_in) was decided by the user so it MUST be exact.
     *
     * The withdrawn amount (amount_out) is determined by the contract and may be subject
     * to unforseen changes (other calls befor ours may change the price, such is the market).
     * We set that the acceptable amount to be withdrawn can never be lower than `slippage`%
     * If the amount did not change the remaining tokens will be left as balance to be
     * withdrawn later by the user.
     */
    actions.push({
      type: 'deposit',
      token: tokenIn,
      amount: quote.amount_in,
    });
    // Withdraw amount minus slippage
    actions.push({
      type: 'withdrawal',
      token: tokenOut,
      amount: quote.amount_out * (1 - (slippage/100)),
    });
  } else if (quote.direction === 'output') {
    /**
     * For output direction the withdraw (amount_out) was decided by the user so it MUST be exact.
     *
     * The deposit amount (amount_in) is determined by the contract and may be subject to
     * unforseen changes (other calls befor ours may change the price, such is the market).
     * We will deposit the `amount_out` plus `slippage`% to account for these changes.
     * If the required deposit was not enough the call will fail, if it was enough any remaining
     * tokens will be left as balance to be withdrawn later by the user.
     */
    actions.push({
      type: 'withdrawal',
      token: tokenOut,
      amount: quote.amount_out,
    });
    // Deposit amount plus slippage
    actions.push({
      type: 'deposit',
      token: tokenIn,
      amount: quote.amount_in * (1 + (slippage/100)),
    });
  } else {
    throw new TokenSwapDirectionError();
  }

  return actions;
}

/**
 * Get the correct swap method on the dozer protocol to execute based on the arguments given.
 *
 * @param {TokenSwapQuote} quote Token swap quote
 */
function getTokenSwapMethod(quote) {
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
    throw new TokenSwapPathError();
  }
  
  const pathN = quote.path.length > 1 ? 'multi' : 'single';
  const method = get(methods, `${quote.direction}.${pathN}`, null);
  if (method === null) {
    throw new TokenSwapMethodError();
  }
  return method;
}

/**
 * Fetch the token swap information for the proposed swap.
 * The swap being proposed will deposit `tokenIn` and withdraw `tokenOut` from the `contractId`.
 * Depending on the direction the `amount` the user chose can either be for deposit (input) or withdraw (output).
 * This method will find the best path and value of the tokens to make the swap happen.
 *
 * @param {'input'|'output'} direction Direction of the swap
 * @param {string} contractId The pool manager to find the swap
 * @param {bigint} amount Amount to swap, may be the input or output amount depending on the direction
 * @param {string} tokenIn Token UID of the deposited token
 * @param {string} tokenOut Token UID of the withdrawn token
 * @returns {Promise<TokenSwapQuote>}
 */
export async function findBestTokenSwap(direction, contractId, amount, tokenIn, tokenOut) {
  const methodByDirection = {
    input: 'find_best_swap_path',
    output: 'find_best_swap_path_exact_output',
  };
  const method = get(methodByDirection, direction, null);
  if (!method) {
    throw new TokenSwapMethodError();
  }
  /**
   * The last parameter is the maximum number of internal pools the swap can traverse
   * (i.e. the max number of steps allowed in the path).
   *
   * The blueprint seemed to indicate that 3 is the default value so I kept it hardcoded for now.
   * If later we understand that this should change we can update the value or make it an argument
   */
  const call = `${method}(${amount},"${tokenIn}","${tokenOut}",3)`;

  try {
    // Call the view method to calculate the best token swap path
    const response = await ncApi.getNanoContractState(contractId, [], [], [call]);

    if (!(response.calls && response.calls[call])) {
      throw new TokenSwapCallError();
    }
    const data = response.calls[call];

    return {
      direction,
      path: data.path.split(',').map(step => parseQuotePathStep(step)),
      pathStr: data.path,
      amounts: data.amounts,
      amount_out: direction === 'input' ? data.amount_out : amount,
      amount_in: direction === 'output' ? data.amount_in : amount,
      price_impact: data.price_impact,
    };
  } catch (_err) {
    // Any error from the call or returned values is considered a call error.
    throw new TokenSwapCallError();
  }
}

/**
 * Will determine the correct swap method to execute and mount the data accordingly.
 *
 * @param {string} contractId The pool manager to find the swap
 * @param {TokenSwapQuote} quote Token swap quote
 * @param {string} tokenIn Token UID of the deposited token
 * @param {string} tokenOut Token UID of the withdrawn token
 * @param {number} slippage Acceptable slippage on the swap amount
 * @returns {[string, Object]} Method name and data required to execute the token swap.
 */
export function buildTokenSwap(contractId, quote, tokenIn, tokenOut, slippage) {
  const method = getTokenSwapMethod(quote);
  const actions = buildTokenSwapActions(quote, tokenIn, tokenOut, slippage);
  const data = {
    ncId: contractId,
    actions,
    args: [],
  };
  if (quote.path.length > 1) {
    // The methods for multi stage paths expect the path string as argument
    data.args.push(quote.pathStr);
  } else {
    // The methods for single stage path expect the pool fee as argument
    data.args.push(quote.path[0].fee);
  }

  // Method and data required to make the token swap
  return [method, data];
}
