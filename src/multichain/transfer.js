/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { t } from 'ttag';
import { hathorToNextAmount, renderNextValue } from './amount';
import { canTransfer, CHAIN, CHAIN_NAME, NEXT_DECIMAL_PLACES, otherChain } from './chains';
import { renderValue } from '../utils';

/**
 * The time a transfer takes, in words.
 *
 * @param {number} seconds
 * @returns {string}
 */
export function arrivalText(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes === 1 ? t`about 1 minute` : t`about ${minutes} minutes`;
}

/**
 * A Hathor Next amount in Hathor Network's units, rounded up: what has to leave Hathor Network
 * for at least that much to arrive.
 *
 * @param {bigint} amount In Hathor Next's units
 * @param {number} hathorDecimalPlaces
 * @returns {bigint} In Hathor Network's units
 */
export function nextToHathorRoundedUp(amount, hathorDecimalPlaces) {
  const scale = 10n ** BigInt(Math.max(0, NEXT_DECIMAL_PLACES - hathorDecimalPlaces));
  return (amount + scale - 1n) / scale;
}

/**
 * What Send says when the amount is more than the send's chain has, for a token the bridge
 * carries. The other chain may have it, or both together may:
 * - when the transfer goes from the other chain to this one, the message offers it, with what to
 *   fill in: to the address being paid, everything; to the wallet's own address, the shortfall;
 * - when it doesn't go that way yet, the message says so.
 * Only Hathor Network to Hathor Next exists so far: `transfer` amounts are in Hathor Network's
 * units.
 *
 * @param {Object} params
 * @param {string} params.chain One of CHAIN: the chain the send is on
 * @param {bigint} params.amount The payment, in this chain's units
 * @param {bigint} params.fee This chain's fee for it, which a transfer straight to the address
 *   doesn't pay
 * @param {bigint} params.available What this chain has, in its units
 * @param {bigint} params.otherAvailable What the other chain has, in its units
 * @param {Object} params.config The side chain config
 * @param {Object|null} params.quote The bridge's quote ({ bridgeFee, networkFee, etaSeconds })
 * @param {string} params.symbol
 * @param {number} params.hathorDecimalPlaces
 * @param {string} params.toAddress The address being paid
 * @param {string|null} params.ownAddress The wallet's own address on this chain
 * @returns {{ message: string, transfer: { amount: bigint, toAddress: string }|null }|null}
 *   null when neither chain, alone or together, has enough
 */
export function shortBalanceAdvice({
  chain,
  amount,
  fee,
  available,
  otherAvailable,
  config,
  quote,
  symbol,
  hathorDecimalPlaces,
  toAddress,
  ownAddress,
}) {
  const other = otherChain(chain);
  // Hathor Next's amounts show as the rest of the app shows them (nextAmountForDisplay).
  const show = (value, c) => (c === CHAIN.HATHOR
    ? renderValue(value, false, hathorDecimalPlaces)
    : renderNextValue(value, hathorDecimalPlaces));
  // An amount of this chain in the other chain's units.
  const inOther = (value) => (chain === CHAIN.HATHOR_NEXT
    ? nextToHathorRoundedUp(value, hathorDecimalPlaces)
    : hathorToNextAmount(value, hathorDecimalPlaces));
  const transferCost = (value) => (quote ? quote.bridgeFee + quote.networkFee : 0n) + value;

  const have = show(available, chain);
  const otherHave = show(otherAvailable, other);
  const chainName = CHAIN_NAME[chain];
  const otherName = CHAIN_NAME[other];
  const transfers = canTransfer(config, other, chain) && quote;

  // Everything from the other chain, straight to the address being paid.
  if (transferCost(inOther(amount)) <= otherAvailable) {
    if (!transfers) {
      return {
        message: t`You have ${have} ${symbol} on ${chainName}. Transfers from ${otherName} to ${chainName} aren't available yet.`,
        transfer: null,
      };
    }
    const eta = arrivalText(quote.etaSeconds);
    return {
      message: t`You have ${have} ${symbol} on ${chainName}. Send from ${otherName} instead? It arrives in ${eta}.`,
      transfer: { amount: inOther(amount) + quote.bridgeFee, toAddress },
    };
  }

  // The shortfall from the other chain, to the wallet's own address, then the send.
  const shortfall = inOther(amount + fee - available);
  if (transferCost(shortfall) > otherAvailable) {
    return null;
  }
  const both = t`You have ${have} ${symbol} on ${chainName} and ${otherHave} ${symbol} on ${otherName}.`;
  if (!transfers || !ownAddress) {
    return { message: both, transfer: null };
  }
  return {
    message: t`${both} Transfer the rest to ${chainName} first.`,
    transfer: { amount: shortfall + quote.bridgeFee, toAddress: ownAddress },
  };
}
