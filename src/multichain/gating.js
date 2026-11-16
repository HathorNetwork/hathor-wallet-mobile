/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  FEATURE_TOGGLE_DEFAULTS,
  MULTICHAIN_FEATURE_TOGGLE,
  NETWORK_MAINNET,
} from '../constants';
import { getSideChainConfig } from './chains';
import { NEXT_STATUS } from './state';

/**
 * Whether the wallet's saved network settings are mainnet's. Hathor Next stays off there whatever
 * Unleash answers: the flags in the state may still be another network's, after a refresh that
 * failed. Mainnet also has no side chain (getSideChainConfig), so neither the settings nor the
 * fullnode's answer alone decides.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function isMainnetSettings(state) {
  return state.networkSettings?.network === NETWORK_MAINNET;
}

/**
 * Whether the flag that shows the side chain setting is on. It is off when Unleash doesn't
 * return it, and always off on mainnet.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function getMultichainFeatureToggle(state) {
  if (isMainnetSettings(state)) {
    return false;
  }
  return Boolean(
    state.featureToggles?.[MULTICHAIN_FEATURE_TOGGLE]
      ?? FEATURE_TOGGLE_DEFAULTS[MULTICHAIN_FEATURE_TOGGLE]
  );
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
  return getSideChainConfig(selectMultichainNetwork(state));
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
 * What "Connect to side chain" is saved under: the network, by the name the fullnode reports.
 * Null until the wallet knows its network.
 *
 * @param {Object} state Redux state
 * @returns {string|null}
 */
export function selectSideChainKey(state) {
  return selectMultichainNetwork(state);
}

/**
 * Whether the user turned "Connect to side chain" on for this network, so both chains show.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function isSideChainConnected(state) {
  const key = selectSideChainKey(state);
  const connected = state.multichain?.connectedNetworks ?? {};
  // Own keys only, and only `true`: a name such as `constructor` is never connected.
  return isSideChainAvailable(state)
    && key !== null
    && Object.prototype.hasOwnProperty.call(connected, key)
    && connected[key] === true;
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
