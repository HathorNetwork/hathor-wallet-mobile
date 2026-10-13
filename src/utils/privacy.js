/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { shielded } from '@hathor/wallet-lib';
import { DEFAULT_PRIVACY_MODE, PRIVACY_MODE, UNBLIND_EXPLORER_URLS } from '../constants';

/**
 * The modes a default privacy mode can take: every mode, as a send offers each one, whatever the
 * recipient.
 */
export const PRIVACY_DEFAULT_MODE_OPTIONS = Object.values(PRIVACY_MODE);

/**
 * The default privacy mode a stored value stands for: the value, when a default can take it, or
 * else DEFAULT_PRIVACY_MODE, as for a network with no default saved.
 *
 * @param {unknown} value The value stored for the network
 * @returns {string} One of PRIVACY_DEFAULT_MODE_OPTIONS
 */
export function normalizePrivacyDefaultMode(value) {
  return PRIVACY_DEFAULT_MODE_OPTIONS.includes(value) ? value : DEFAULT_PRIVACY_MODE;
}

/**
 * wallet-lib's encoder of the unblinding values of a tx, which the explorer reads from the
 * #unblind= fragment of the tx's link: encodeShieldedUnblindingPayload(txId, outputs, inputs),
 * with the openings getShieldedUnblindingForTx gives. It is looked up at each call, never when a
 * module loads, so a wallet-lib build without it fails nothing; it is null then.
 *
 * @returns {function(string, Object[], Object[]): string|null}
 */
export function getUnblindingEncoder() {
  const encoder = shielded?.encodeShieldedUnblindingPayload;
  return typeof encoder === 'function' ? encoder : null;
}

const withoutTrailingSlashes = (url) => url.replace(/\/+$/, '');

/**
 * Whether the explorer at the URL reads the unblinding values from the #unblind= fragment of a
 * tx's link: one of UNBLIND_EXPLORER_URLS, with or without trailing slashes.
 *
 * @param {string|null|undefined} explorerUrl The explorer URL of the network settings
 * @returns {boolean}
 */
export function supportsUnblindLink(explorerUrl) {
  if (typeof explorerUrl !== 'string' || explorerUrl === '') {
    return false;
  }
  const url = withoutTrailingSlashes(explorerUrl);
  return UNBLIND_EXPLORER_URLS.some((known) => withoutTrailingSlashes(known) === url);
}
