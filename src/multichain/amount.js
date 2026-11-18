/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { renderValue } from '../utils';
import { NEXT_DECIMAL_PLACES } from './chains';

/**
 * An HTR amount of Hathor Network, in Hathor Next's units. Hathor Network amounts have the
 * network's decimal places (2 on every network so far) and Hathor Next amounts have 8, so 1.00
 * HTR (100) is 1.00000000 HTR (100000000) on Hathor Next.
 *
 * @param {bigint} amount In Hathor Network's units
 * @param {number} hathorDecimalPlaces serverInfo.decimal_places
 * @returns {bigint} In Hathor Next's units
 */
export function hathorToNextAmount(amount, hathorDecimalPlaces) {
  const diff = NEXT_DECIMAL_PLACES - hathorDecimalPlaces;
  if (diff >= 0) {
    return amount * (10n ** BigInt(diff));
  }
  return amount / (10n ** BigInt(-diff));
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
