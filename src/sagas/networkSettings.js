import { all, takeEvery, put, call, race, take, delay } from 'redux-saga/effects';
import { config } from '@hathor/wallet-lib';
import { isEmpty } from 'lodash';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { featureToggleUpdate, networkSettingsUpdateFailure, networkSettingsUpdateSuccess, reloadWalletRequested, types } from '../actions';
import { HTTP_REQUEST_TIMEOUT, NETWORK, networkSettingsKeyMap, NETWORK_TESTNET, STAGE, STAGE_DEV_PRIVNET, STAGE_TESTNET } from '../constants';
import { getFullnodeNetwork, getWalletServiceNetwork } from './helpers';
import { STORE } from '../store';

/**
 * Initialize network settings saga.
 *
 * It looks up a stored network settings to upddate the redux state.
 */
export function* initNetworkSettings() {
  const customNetwork = STORE.getItem(networkSettingsKeyMap.networkSettings);
  if (customNetwork) {
    yield put(networkSettingsUpdateSuccess(customNetwork));
  }
}

/**
 * Takes the network settings input to be processed, passing
 * through a validation process that will either yield a
 * failure or a success effect.
 *
 * @param {{
 *    payload: {
 *      stage: string,
 *      network: string,
 *      nodeUrl: string,
 *      explorerUrl: string,
 *      explorerServiceUrl: string,
 *      walletServiceUrl?: string
 *      walletServiceWsUrl?: string
 *    }
 * }} action contains the payload with the new
 * network settings requested by the user to be processd.
 */
export function* updateNetworkSettings(action) {
  const {
    nodeUrl,
    explorerUrl,
    explorerServiceUrl,
    walletServiceUrl,
    walletServiceWsUrl,
  } = action.payload || {};

  // validates input emptyness
  if (isEmpty(action.payload)) {
    yield put(networkSettingsUpdateFailure());
    return;
  }

  // validates explorerUrl
  // - required
  // - should have a valid URL
  if (isEmpty(explorerUrl) || invalidUrl(explorerUrl)) {
    yield put(networkSettingsUpdateFailure());
    return;
  }

  // validates explorerServiceUrl
  // - required
  // - should have a valid URL
  if (isEmpty(explorerServiceUrl) || invalidUrl(explorerServiceUrl)) {
    yield put(networkSettingsUpdateFailure());
    return;
  }

  // validates nodeUrl
  // - required
  // - should have a valid URl
  if (isEmpty(nodeUrl) || invalidUrl(nodeUrl)) {
    yield put(networkSettingsUpdateFailure());
    return;
  }

  // validates walletServiceUrl
  // - optional
  // - should have a valid URL, if given
  if (walletServiceUrl && invalidUrl(walletServiceUrl)) {
    yield put(networkSettingsUpdateFailure());
    return;
  }

  // validates walletServiceWsUrl
  // - conditionally required
  // - should have a valid URL, if walletServiceUrl is given
  if (walletServiceUrl && invalidUrl(walletServiceWsUrl)) {
    yield put(networkSettingsUpdateFailure());
    return;
  }

  // NOTE: Should we allow that all the URLs be equals?
  // In practice they will never be equals.

  const backupUrl = {
    nodeUrl: config.getServerUrl(),
    explorerServiceUrl: config.getExplorerServiceBaseUrl(),
    walletServiceUrl: config.getWalletServiceBaseUrl(),
    walletServiceWsUrl: config.getWalletServiceBaseWsUrl(),
  };

  config.setServerUrl(nodeUrl);
  config.setExplorerServiceBaseUrl(explorerServiceUrl);

  // - walletServiceUrl has precedence
  // - nodeUrl as fallback
  let network;
  if (walletServiceUrl) {
    config.setWalletServiceBaseUrl(walletServiceUrl);
    config.setWalletServiceBaseWsUrl(walletServiceWsUrl);

    try {
      network = yield call(getWalletServiceNetwork);
    } catch (err) {
      rollbackConfigUrls(backupUrl);
      yield put(networkSettingsUpdateFailure());
      return;
    }
  }

  if (!network) {
    try {
      network = yield call(getFullnodeNetwork);
    } catch (err) {
      rollbackConfigUrls(backupUrl);
      yield put(networkSettingsUpdateFailure());
      return;
    }
  }

  // Fail after try get network from fullnode
  if (!network) {
    yield put(networkSettingsUpdateFailure());
    return;
  }

  let stage;
  if (network === NETWORK_TESTNET) {
    stage = STAGE_TESTNET;
  } else if (network === NETWORK) {
    stage = STAGE;
  } else {
    stage = STAGE_DEV_PRIVNET;
  }

  const customNetwork = {
    stage,
    network,
    nodeUrl,
    explorerUrl,
    explorerServiceUrl,
    walletServiceUrl,
    walletServiceWsUrl,
  };

  yield put(networkSettingsUpdateSuccess(customNetwork));
}

/**
 * Rollback the URLs configured in the wallet by using the backupUrl object.
 * @param {{
 *   nodeUrl: string;
 *   explorerServiceUrl: string;
 *   walletServiceUrl: string;
 *   walletServiceWsUrl: string;
 * }} backupUrl An object containing the previous configuration for wallet URLs.
 */
function rollbackConfigUrls(backupUrl) {
  config.setServerUrl(backupUrl.nodeUrl);
  config.setExplorerServiceBaseUrl(backupUrl.explorerServiceUrl);
  config.setWalletServiceBaseUrl(backupUrl.walletServiceUrl);
  config.setWalletServiceBaseWsUrl(backupUrl.walletServiceWsUrl);
}

/**
 * Check if the value is an invalid URL.
 *
 * @param {string} value to be checked.
 * @returns {boolean} true if invalid, false otherwise.
 */
function invalidUrl(value) {
  const allowedProtocols = ['http:', 'https:', 'ws:', 'wss:'];
  try {
    const tryUrl = new URL(value);
    if (isEmpty(tryUrl.protocol) || !(allowedProtocols.includes(tryUrl.protocol))) {
      return true;
    }

    if (isEmpty(tryUrl.host)) {
      return true;
    }
  } catch {
    return true;
  }

  return false;
}

/**
 * Saves the network custom settings in the application storage.
 * @param {object} action contains the payload with the network settings
 * already saved in the redux store.
 */
export function* persistNetworkSettings(action) {
  // persists after reducer being updated
  const networkSettings = action.payload;
  const strNetworkSettings = JSON.stringify(networkSettings);
  yield call(AsyncStorage.setItem, networkSettingsKeyMap.networkSettings, strNetworkSettings);

  // trigger toggle update to be managed by featureToggle saga
  yield put(featureToggleUpdate());

  // if wallet-service is being deactivated, it will trigger the reload,
  // otherwise we should trigger by ourselves
  const { timeout } = yield race({
    reload: take(types.RELOAD_WALLET_REQUESTED),
    timeout: delay(HTTP_REQUEST_TIMEOUT),
  });

  if (timeout) {
    yield put(reloadWalletRequested());
  }
}

/**
 * Deletes the network settings from the application storage.
 */
export function* cleanNetworkSettings() {
  STORE.removeItem(networkSettingsKeyMap.networkSettings);
  yield 0;
}

/**
 * Maps the side effects to the action types.
 */
export function* saga() {
  yield all([
    takeEvery(types.START_WALLET_SUCCESS, initNetworkSettings),
    takeEvery(types.NETWORKSETTINGS_UPDATE, updateNetworkSettings),
    takeEvery(types.NETWORKSETTINGS_UPDATE_SUCCESS, persistNetworkSettings),
    takeEvery(types.RESET_WALLET, cleanNetworkSettings),
  ]);
}
