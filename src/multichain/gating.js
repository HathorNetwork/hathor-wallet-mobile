/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  FEATURE_TOGGLE_DEFAULTS,
  MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE,
  MULTICHAIN_FEATURE_TOGGLE,
  MULTICHAIN_NETWORK_PRESET_FEATURE_TOGGLE,
} from '../constants';
import { FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY, STORE } from '../store';
import { getSideChainConfig } from './chains';
import { NEXT_STATUS } from './state';

/**
 * Whether the flag that shows the side chain setting is on. It is off when Unleash doesn't
 * return it.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function getMultichainFeatureToggle(state) {
  return Boolean(
    state.featureToggles?.[MULTICHAIN_FEATURE_TOGGLE]
      ?? FEATURE_TOGGLE_DEFAULTS[MULTICHAIN_FEATURE_TOGGLE]
  );
}

/**
 * The flag as an unlock that can't wait for Unleash knows it: Unleash's answer once it came,
 * otherwise the one this device saved from Unleash last time. A saved answer lists only the flags
 * Unleash returned, so a flag missing from it was off. With neither, the default: off.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function getMultichainFeatureToggleAtUnlock(state) {
  if (state.featureTogglesInitialized) {
    return getMultichainFeatureToggle(state);
  }
  const saved = STORE.getItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY);
  return Boolean(
    saved?.[MULTICHAIN_FEATURE_TOGGLE] ?? FEATURE_TOGGLE_DEFAULTS[MULTICHAIN_FEATURE_TOGGLE]
  );
}

/**
 * Whether the flag that shows the Hathor Next Devnet preset in Network Settings is on.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function getMultichainNetworkPresetFeatureToggle(state) {
  return Boolean(
    state.featureToggles?.[MULTICHAIN_NETWORK_PRESET_FEATURE_TOGGLE]
      ?? FEATURE_TOGGLE_DEFAULTS[MULTICHAIN_NETWORK_PRESET_FEATURE_TOGGLE]
  );
}

/**
 * Whether the Hathor Next backend for local testing may show and run: its own flag, on top of the
 * multichain one.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function getMultichainDevBackendFeatureToggle(state) {
  return getMultichainFeatureToggle(state) && Boolean(
    state.featureToggles?.[MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE]
      ?? FEATURE_TOGGLE_DEFAULTS[MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE]
  );
}

/**
 * The backend for local testing that is in force: the one set in Settings, and only while its
 * flag is on. A saved one waits, unused, while the flag is off.
 *
 * @param {Object} state Redux state
 * @returns {{ url: string, pins: Object }|null}
 */
export function selectDevBackend(state) {
  if (!getMultichainDevBackendFeatureToggle(state)) {
    return null;
  }
  return state.multichain?.devBackend ?? null;
}

/**
 * The network the side chain setting is kept for: the name the fullnode reports. Null until the
 * wallet has started.
 *
 * @param {Object} state Redux state
 * @returns {string|null}
 */
export function selectMultichainNetwork(state) {
  return state.fullNodeNetworkName || null;
}

/**
 * The side chain of the network the wallet runs on, or null when it has none.
 *
 * @param {Object} state Redux state
 * @returns {Object|null}
 */
export function selectSideChainConfig(state) {
  return getSideChainConfig(
    selectMultichainNetwork(state),
    selectDevBackend(state),
    state.networkSettings?.nodeUrl ?? null,
  );
}

/**
 * Whether the "Connect to side chain" setting shows: the flag is on and the network has a side
 * chain.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function isSideChainAvailable(state) {
  return getMultichainFeatureToggle(state) && selectSideChainConfig(state) !== null;
}

/**
 * Whether the user turned "Connect to side chain" on for this network, so both chains show.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function isSideChainConnected(state) {
  const network = selectMultichainNetwork(state);
  return isSideChainAvailable(state)
    && Boolean(network && state.multichain?.connectedNetworks?.[network]);
}

/**
 * Whether the app waits for Hathor Next before it opens: the side chain is connected and Hathor
 * Next hasn't loaded yet, or failed to.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function isWaitingForNext(state) {
  return isSideChainConnected(state) && state.multichain.next.status !== NEXT_STATUS.READY;
}

const NO_TOKEN_MAP = [];

/**
 * The tokens the side chain's bridge carries, by their id on each chain, while the side chain is
 * connected: each shows as one row with its balance on both chains. Empty otherwise.
 *
 * @param {Object} state Redux state
 * @returns {{ hathor: string, next: string }[]}
 */
export function selectTokenMap(state) {
  if (!isSideChainConnected(state)) {
    return NO_TOKEN_MAP;
  }
  return selectSideChainConfig(state)?.tokenMap ?? NO_TOKEN_MAP;
}

/**
 * The Hathor Next id of a Hathor Network token the bridge carries, or null.
 *
 * @param {Object} state Redux state
 * @param {string} hathorUid
 * @returns {string|null}
 */
export function selectMappedNextId(state, hathorUid) {
  return selectTokenMap(state).find((pair) => pair.hathor === hathorUid)?.next ?? null;
}
