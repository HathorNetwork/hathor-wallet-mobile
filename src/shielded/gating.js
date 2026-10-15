/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_NETWORK_PRESET_FEATURE_TOGGLE,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
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

/**
 * Whether the flag that shows the Shielded Testnet preset in Network Settings is on. It is off
 * when Unleash doesn't return it.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function getShieldedNetworkPresetFeatureToggle(state) {
  return Boolean(
    state.featureToggles?.[SHIELDED_NETWORK_PRESET_FEATURE_TOGGLE]
      ?? FEATURE_TOGGLE_DEFAULTS[SHIELDED_NETWORK_PRESET_FEATURE_TOGGLE]
  );
}

/**
 * Whether a wallet start registers the shielded crypto provider: on the shielded testnet, on
 * either facade, a seed wallet or a passkey wallet with shielded keys. For a seed wallet it
 * decides by wallet type, not by keys: a wallet created before shielded outputs gets its shielded
 * keys during start(), after the provider must be set. A passkey wallet gets them from a passkey
 * ceremony before start() (see passkey/shieldedKeys.js), so it decides by the shielded xpubs the
 * wallet stores.
 *
 * It ignores the flag, so the private funds a wallet received keep counting in its balance
 * while the shielded UI is hidden. Elsewhere no provider is registered, so wallet-lib does no
 * shielded address work.
 *
 * @param {Object} params
 * @param {Object} params.networkSettings The selected network settings
 * @param {boolean} params.isPasskeyWallet Whether it is a passkey wallet
 * @param {boolean} [params.passkeyShieldedKeys] Whether the passkey wallet stores its shielded
 *   xpubs (getPasskeyShieldedXpubs)
 * @returns {boolean}
 */
export function shouldRegisterShieldedProvider({
  networkSettings,
  isPasskeyWallet,
  passkeyShieldedKeys = false,
}) {
  return isShieldedNetwork(networkSettings) && (!isPasskeyWallet || passkeyShieldedKeys);
}

/**
 * The running wallet's shielded capability, or null until the wallet reports one.
 *
 * @param {Object} state Redux state
 * @returns {Object|null} IShieldedCapability
 */
export function selectShieldedCapability(state) {
  return state.shielded?.capability ?? null;
}

/**
 * Whether the app may show shielded UI at all: the flag is on, the network the wallet runs on (the
 * fullnode's, or the wallet-service's) is the shielded testnet, and a crypto provider was
 * registered for the wallet or failed to load. A provider is only ever tried for seed wallets and
 * passkey wallets with shielded keys, so this also rules out passkey wallets without them.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function isShieldedEnvironment(state) {
  const providerStatus = state.shielded?.providerStatus ?? SHIELDED_PROVIDER_STATUS.UNREGISTERED;
  return getShieldedFeatureToggle(state)
    && isShieldedNetworkName(state.fullNodeNetworkName)
    && providerStatus !== SHIELDED_PROVIDER_STATUS.UNREGISTERED;
}

/**
 * Whether the shielded environment holds and the crypto provider passed its self-test, at any
 * capability level: a locked wallet ('watch') can still be unlocked.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function isShieldedAvailable(state) {
  return isShieldedEnvironment(state)
    && state.shielded.providerStatus === SHIELDED_PROVIDER_STATUS.READY;
}

/**
 * Whether the wallet decodes its shielded outputs: shielded support is available and the
 * capability level is 'view' or 'full'.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function isShieldedEnabled(state) {
  const level = selectShieldedCapability(state)?.level;
  return isShieldedAvailable(state) && (level === 'view' || level === 'full');
}

/**
 * Whether a locked wallet (level 'watch') can be unlocked: by the PIN for a seed wallet, by a
 * passkey ceremony for a passkey wallet. Neither fixes a stored scan key that doesn't decrypt to a
 * valid one ('corrupt-key'), nor a scan key given at start that isn't the key of the stored scan
 * xpub ('key-mismatch'): the same root gives the same key again.
 *
 * @param {Object|null} capability The wallet's IShieldedCapability
 * @returns {boolean}
 */
export function isUnlockableLock(capability) {
  return capability?.level === 'watch'
    && capability.cause !== 'corrupt-key'
    && capability.cause !== 'key-mismatch';
}

/**
 * Whether the wallet can send privately, now or once the user unlocks its private balance with
 * the PIN or the passkey: shielded support is available and the capability level is 'full', or
 * 'watch' with a cause an unlock can fix (isUnlockableLock). A private send needs 'full': it may
 * spend the wallet's private outputs, and its private change must be decoded as soon as it is
 * sent.
 *
 * @param {Object} state Redux state
 * @returns {boolean}
 */
export function canSendPrivately(state) {
  if (!isShieldedAvailable(state)) {
    return false;
  }
  const capability = selectShieldedCapability(state);
  if (capability?.level === 'full') {
    return true;
  }
  return isUnlockableLock(capability);
}
