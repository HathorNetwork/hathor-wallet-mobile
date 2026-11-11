/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FEATURE_TOGGLE_DEFAULTS, MULTICHAIN_FEATURE_TOGGLE } from '../constants';
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
