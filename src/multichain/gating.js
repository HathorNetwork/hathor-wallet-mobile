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
  MULTICHAIN_TOKEN_CREATE_FEATURE_TOGGLE,
  NETWORK_MAINNET,
  NETWORK_PRIVATENET,
} from '../constants';
import { FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY, STORE } from '../store';
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
  return getMultichainRolloutFlag(state);
}

/**
 * The multichain flag as Unleash gives it, on any network. Only the unlock reads it, to decide
 * whether to derive the Hathor Next keys: they stay in memory, so switching to a network with a
 * side chain needs no PIN, and nothing on mainnet uses them. Everything else reads
 * getMultichainFeatureToggle, which is off on mainnet.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function getMultichainRolloutFlag(state) {
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
    return getMultichainRolloutFlag(state);
  }
  const saved = STORE.getItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY);
  return Boolean(
    saved?.[MULTICHAIN_FEATURE_TOGGLE] ?? FEATURE_TOGGLE_DEFAULTS[MULTICHAIN_FEATURE_TOGGLE]
  );
}

/**
 * Whether the flag that shows the Hathor Next Testnet preset in Network Settings is on.
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
 * Whether token creation on Hathor Next may show: its own flag, under the multichain one.
 *
 * @param {Object} state
 * @returns {boolean}
 */
export function getMultichainTokenCreateFeatureToggle(state) {
  return getMultichainFeatureToggle(state) && Boolean(
    state.featureToggles?.[MULTICHAIN_TOKEN_CREATE_FEATURE_TOGGLE]
      ?? FEATURE_TOGGLE_DEFAULTS[MULTICHAIN_TOKEN_CREATE_FEATURE_TOGGLE]
  );
}

/**
 * Whether the wallet can create a token on Hathor Next now: the flag is on, Hathor Next is
 * connected and ready, and its backend creates tokens.
 *
 * @param {Object} state
 * @returns {boolean}
 */
export function canCreateNextTokens(state) {
  return getMultichainTokenCreateFeatureToggle(state)
    && isSideChainConnected(state)
    && state.multichain.next.status === NEXT_STATUS.READY
    && state.multichain.next.canCreateTokens === true;
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
 * What "Connect to side chain" is saved under: the network, by the name the fullnode reports.
 * Every privatenet reports the same name, so a privatenet's node is part of it: the side chain
 * turned on for one privatenet is not on for another. The backend for local testing is
 * not: switching to it, or back, keeps the setting. Null until the wallet knows its network.
 *
 * @param {Object} state Redux state
 * @returns {string|null}
 */
export function selectSideChainKey(state) {
  const network = selectMultichainNetwork(state);
  if (network !== NETWORK_PRIVATENET) {
    return network;
  }
  const nodeUrl = (state.networkSettings?.nodeUrl ?? '').trim().replace(/\/+$/, '');
  return `${network} ${nodeUrl}`;
}

/**
 * Which Hathor Next the app is on: the network's side chain and the backend it runs on. A
 * creation authorized on one is never signed on another.
 *
 * @param {Object} state Redux state
 * @returns {string|null} Null where the network has no side chain
 */
export function selectSideChainConnection(state) {
  const config = selectSideChainConfig(state);
  return config ? `${selectSideChainKey(state)} ${config.backendUrl}` : null;
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
