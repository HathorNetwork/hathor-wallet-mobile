/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PRE_SETTINGS_SHIELDED_TESTNET } from '../constants';

// The preset's settings other than its wallet-service URLs.
const PRESET_KEYS = Object.keys(PRE_SETTINGS_SHIELDED_TESTNET)
  .filter((key) => key !== 'walletServiceUrl' && key !== 'walletServiceWsUrl');

/**
 * The stored network settings with the shielded testnet preset's wallet-service URLs filled in,
 * or null when they need no change. The preset had no wallet-service before, so an install that
 * picked it kept settings without one, and would stay on the fullnode facade. Only the preset is
 * changed: the preset's settings, with null wallet-service URLs. A custom network is left as the
 * user saved it, as the Customize form saves an empty wallet-service URL as ''.
 *
 * @param {Object|null|undefined} settings The network settings the app storage holds
 * @returns {Object|null}
 */
export function migrateShieldedTestnetPreset(settings) {
  if (!settings
    || settings.walletServiceUrl != null
    || settings.walletServiceWsUrl != null
    || PRESET_KEYS.some((key) => settings[key] !== PRE_SETTINGS_SHIELDED_TESTNET[key])) {
    return null;
  }
  return {
    ...settings,
    walletServiceUrl: PRE_SETTINGS_SHIELDED_TESTNET.walletServiceUrl,
    walletServiceWsUrl: PRE_SETTINGS_SHIELDED_TESTNET.walletServiceWsUrl,
  };
}
