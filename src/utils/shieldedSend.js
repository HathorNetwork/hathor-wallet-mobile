/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants as hathorLibConstants } from '@hathor/wallet-lib';
import { DEFAULT_PRIVACY_MODE, PRIVACY_MODE } from '../constants';

const { MAX_SHIELDED_OUTPUT_VALUE } = hathorLibConstants;

/**
 * The privacy modes a send to the recipient can take. A legacy address can only receive a
 * public output. A private address only gets private ones: a public output to it would pay the
 * address of its spend key, in public.
 *
 * @param {boolean} recipientIsShielded Whether the recipient is a private (shielded) address
 * @returns {string[]} Modes of PRIVACY_MODE
 */
export function getPrivacyModeOptions(recipientIsShielded) {
  return recipientIsShielded
    ? [PRIVACY_MODE.HIDE_AMOUNT, PRIVACY_MODE.PRIVATE]
    : [PRIVACY_MODE.PUBLIC];
}

/**
 * The mode a send starts in: the preferred mode when the recipient can take it, else the first
 * mode it can take.
 *
 * @param {string[]} options The modes the send can take, from getPrivacyModeOptions
 * @param {string} [preferred] The preferred mode
 * @returns {string}
 */
export function initialPrivacyMode(options, preferred = DEFAULT_PRIVACY_MODE) {
  return options.includes(preferred) ? preferred : options[0];
}

/**
 * The largest amount a private output can hold, in base units: a shielded output's range proof
 * covers values below MAX_SHIELDED_OUTPUT_VALUE.
 */
export const MAX_PRIVATE_AMOUNT = MAX_SHIELDED_OUTPUT_VALUE - 1n;

/**
 * Whether a private output can hold the amount.
 *
 * @param {bigint} amount In base units
 * @returns {boolean}
 */
export function isPrivateAmountAllowed(amount) {
  return amount > 0n && amount < MAX_SHIELDED_OUTPUT_VALUE;
}
