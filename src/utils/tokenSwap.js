/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ncApi } from '@hathor/wallet-lib';
import { get } from 'lodash';
import { getNetworkSettings } from '../sagas/helpers';
import { renderValue } from '../utils';

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
 * @property {'input'|'output'} direction User decided the deposit (in) or withdraw (out).
 * @property {TokenSwapPathStep[]} path Path the token swap will take.
 * @property {string} pathStr Value returned by the contract before parsing.
 * @property {number[]} amounts Value of the swap at each step.
 * @property {number} amount_in Amount to deposited.
 * @property {number} amount_out Amount to be withdrawn.
 * @property {number} price_impact percentage value of how the swap will affect the price.
 */

/**
 * @typedef {Object} TokenData
 * @property {string} name
 * @property {string} symbol
 * @property {string} uid
 * @property {string} [icon]
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
 * Calculate the actual value to deposit/withdraw with slippage applied.
 * Some special considerations must be made since slippage calculation is inherently fractional
 * and amount should be expressed as bigint values which cannot be fractional.
 * @param {'input'|'output'} direction
 * @param {number|bigint} amount
 * @param {number} slippage
 * @returns {bigint}
 */
export function calcAmountWithSlippage(direction, amount, slippage) {
  if (direction === 'input') {
    // amount - slippage% but
    // amount (1 - slippage/100) = amount (1000 - slippage*10) / 1000
    // We use slippage*10 because it can be a fraction (e.g. 0.5)
    // The floor value will automatically be used since BigInt cannot be fractional.
    return (BigInt(amount) * (1000n - BigInt(Math.ceil(slippage * 10)))) / 1000n;
  } if (direction === 'output') {
    // amount + slippage% but
    // Same reasoning as input direction, but when a fractional value remains
    // we have to use the ceiling value.
    const numerator = (BigInt(amount) * (1000n + BigInt(Math.ceil(slippage * 10))));
    const remainder = numerator % 1000n;
    let value = numerator / 1000n;
    if (remainder !== 0n) {
      value += 1n;
    }
    return value;
  }
  throw TokenSwapDirectionError();
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
      amount: calcAmountWithSlippage('input', quote.amount_out, slippage),
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
      amount: calcAmountWithSlippage('output', quote.amount_in, slippage),
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
    input: {
      single: 'swap_exact_tokens_for_tokens',
      multi: 'swap_exact_tokens_for_tokens_through_path',
    },
    output: {
      single: 'swap_tokens_for_exact_tokens',
      multi: 'swap_tokens_for_exact_tokens_through_path',
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
 * Depending on the direction the `amount` the user chose can either be for deposit (input)
 * or withdraw (output).
 * This method will find the best path and value of the tokens to make the swap happen.
 *
 * @param {'input'|'output'} direction Direction of the swap
 * @param {string} contractId The pool manager to find the swap
 * @param {bigint} amount Amount to swap, may be the input or output amount based on the direction
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

    if (!(response.calls && response.calls[call] && response.calls[call].value)) {
      throw new TokenSwapCallError();
    }
    const data = response.calls[call].value;

    return {
      direction,
      path: data[0] === '' ? '' : data[0].split(',').map((step) => parseQuotePathStep(step)),
      pathStr: data[0],
      amounts: data[1],
      amount_out: direction === 'input' ? data[2] : amount,
      amount_in: direction === 'output' ? data[2] : amount,
      price_impact: data[3],
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

/**
 * Selector method to get the correct token swap data for the connected network.
 * This method assumes that the network settings are up-to-date.
 * Will return `null` if the allowed token list is invalid or not present for the current network.
 * @param {Object} state
 * @returns {null|Object}
 */
export function selectTokenSwapData(state) {
  const networkSettings = getNetworkSettings(state);
  const { network } = networkSettings;
  if (!(state.tokenSwapAllowedTokens && state.tokenSwapAllowedTokens.networks)) {
    return null;
  }
  if (!state.tokenSwapAllowedTokens.networks[network]) {
    return null;
  }
  return state.tokenSwapAllowedTokens.networks[network];
}

/**
 * Selector method to get the correct allowed tokens for the connected network.
 * This method assumes that the network settings are up-to-date.
 * Will return `null` if the allowed token list is invalid or not present for the current network.
 * @param {Object} state
 * @returns {null|TokenData[]}
 */
export function selectTokenSwapAllowedTokens(state) {
  const data = selectTokenSwapData(state);
  if (!data) {
    return null;
  }
  return data.tokens;
}

/**
 * Selector method to get the correct token swap contractId for the connected network.
 * This method assumes that the network settings are up-to-date.
 * Will return `null` if the allowed token list is invalid or not present for the current network.
 * @param {Object} state
 * @returns {null|string}
 */
export function selectTokenSwapContractId(state) {
  const data = selectTokenSwapData(state);
  if (!data) {
    return null;
  }
  return data.pool_manager;
}

/**
 * Render amount and token symbol for UI components.
 * @param {number|bigint} amount
 * @param {TokenData} token
 */
export function renderAmountAndSymbol(amount, token){
  return `${renderValue(amount, false)} ${token.symbol}`;
}

/**
 * Render amount and token symbol for UI components taking into consideration the slippage
 * Slippage effect will change depending on the direction.
 * @param {'input'|'output'} direction
 * @param {number|bigint} amount
 * @param {TokenData} token
 * @param {number} slippage
 */
export function renderAmountAndSymbolWithSlippage(direction, amount, token, slippage){
  const newAmount = calcAmountWithSlippage(direction, amount, slippage);
  return renderAmountAndSymbol(newAmount, token);
}

/**
 * Render conversion rate for the quote given
 * @param {TokenSwapQuote} quote
 * @param {TokenData} inToken
 * @param {TokenData} outToken
 */
export function renderConversionRate(quote, inToken, outToken) {
  if (!quote) {
    return null;
  }
  if ((!quote.amount_in) || quote.amount_in === 0) {
    // Invalid but we should avoid rendering errors
    return `${renderAmountAndSymbol(100, outToken)} = ${renderAmountAndSymbol(0, inToken)}`;
  }
  const exchangeRate = Number(quote.amount_out) / Number(quote.amount_in);
  return `${renderAmountAndSymbol(100 * exchangeRate, outToken)} = ${renderAmountAndSymbol(100, inToken)}`;
}
