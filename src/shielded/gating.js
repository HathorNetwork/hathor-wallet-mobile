/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
} from '../constants';

/**
 * Whether a network name is the shielded testnet's. Pass the name the fullnode reports
 * (state.fullNodeNetworkName), never a genesis hash: the shielded testnet shares its genesis
 * with the public testnet.
 *
 * @param {string|null|undefined} networkName
 * @returns {boolean}
 */
export function isShieldedNetworkName(networkName) {
  return networkName === FULL_NETWORK_SHIELDED_TESTNET;
}

/**
 * Whether the selected network settings are the shielded testnet's: the preset, or a custom
 * network whose node reported the shielded testnet's name when it was saved.
 *
 * @param {Object|null|undefined} networkSettings
 * @returns {boolean}
 */
export function isShieldedNetwork(networkSettings) {
  return isShieldedNetworkName(networkSettings?.fullNetwork);
}

/**
 * Whether the flag that shows the shielded outputs UI is on. It is off when Unleash doesn't
 * return it.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function getShieldedFeatureToggle(state) {
  return Boolean(
    state.featureToggles?.[SHIELDED_OUTPUTS_FEATURE_TOGGLE]
      ?? FEATURE_TOGGLE_DEFAULTS[SHIELDED_OUTPUTS_FEATURE_TOGGLE]
  );
}
