/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { renderValue } from '../utils';
import { NEXT_DECIMAL_PLACES } from './chains';

/**
 * How many of Hathor Next's base units one base unit of Hathor Network's HTR becomes in a
 * transfer: the side chain's own pinned value (its config's mintScale), never worked out from the
 * decimal places. hathor-next's devnet mints one base unit for one; the hosted network's scale is
 * the hathor-next team's decision.
 *
 * @param {Object|null} config The side chain config
 * @returns {bigint}
 */
export function mintScaleOf(config) {
  return BigInt(config?.mintScale ?? 1);
}

/**
 * An HTR amount of Hathor Network, in Hathor Next's units, at the transfer's scale.
 *
 * @param {bigint} amount In Hathor Network's units
 * @param {bigint} scale mintScaleOf(config)
 * @returns {bigint} In Hathor Next's units
 */
export function hathorToNextAmount(amount, scale) {
  return amount * scale;
}

/**
 * The least Hathor Network amount that becomes at least `amount` on Hathor Next.
 *
 * @param {bigint} amount In Hathor Next's units
 * @param {bigint} scale mintScaleOf(config)
 * @returns {bigint} In Hathor Network's units
 */
export function nextToHathorRoundedUp(amount, scale) {
  return (amount + scale - 1n) / scale;
}

/**
 * A Hathor Next amount in Hathor Network's units. Digits Hathor Network can't hold are dropped,
 * never rounded up, so an amount is never overstated.
 *
 * @param {bigint} amount In Hathor Next's units
 * @param {number} hathorDecimalPlaces serverInfo.decimal_places
 * @returns {bigint} In Hathor Network's units
 */
export function nextToHathorAmount(amount, hathorDecimalPlaces) {
  const diff = NEXT_DECIMAL_PLACES - hathorDecimalPlaces;
  if (diff >= 0) {
    return amount / (10n ** BigInt(diff));
  }
  return amount * (10n ** BigInt(-diff));
}

/**
 * A Hathor Next amount the way the screens show it: with Hathor Network's decimal places when it
 * has no more digits than those, so 120.00000000 reads 120.00 as Hathor Network's amounts do, and
 * with Hathor Next's 8 otherwise.
 *
 * @param {bigint} amount In Hathor Next's units
 * @param {number} hathorDecimalPlaces serverInfo.decimal_places
 * @returns {{ amount: bigint, decimalPlaces: number }} The amount in the units it shows in
 */
export function nextAmountForDisplay(amount, hathorDecimalPlaces) {
  const extra = NEXT_DECIMAL_PLACES - hathorDecimalPlaces;
  if (extra <= 0 || amount % (10n ** BigInt(extra)) !== 0n) {
    return { amount, decimalPlaces: NEXT_DECIMAL_PLACES };
  }
  return {
    amount: nextToHathorAmount(amount, hathorDecimalPlaces),
    decimalPlaces: hathorDecimalPlaces,
  };
}

/**
 * A Hathor Next amount as text, with nextAmountForDisplay's decimals.
 *
 * @param {bigint} amount In Hathor Next's units
 * @param {number} hathorDecimalPlaces serverInfo.decimal_places
 * @param {string} [amountFormat]
 * @returns {string}
 */
export function renderNextValue(amount, hathorDecimalPlaces, amountFormat) {
  const shown = nextAmountForDisplay(amount, hathorDecimalPlaces);
  return renderValue(shown.amount, false, shown.decimalPlaces, amountFormat);
}
