/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DEFAULT_PRIVACY_MODE } from '../constants';
import { getPrivacyModeOptions } from './shieldedSend';

/**
 * The modes a default privacy mode can take. The default applies only to sends to private
 * addresses, which take the private modes: a legacy address only takes a public send, and a
 * private address never gets one.
 */
export const PRIVACY_DEFAULT_MODE_OPTIONS = getPrivacyModeOptions(true);

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
