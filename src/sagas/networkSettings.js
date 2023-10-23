import { all, takeEvery, put, call, race, take, delay, select } from 'redux-saga/effects';
import { config } from '@hathor/wallet-lib';
import { isEmpty } from 'lodash';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from 'ttag';
import {
  featureToggleUpdate,
  networkSettingsPersistStore,
  networkSettingsUpdateErrors,
  networkSettingsUpdateFailure,
  networkSettingsUpdateReady,
  networkSettingsUpdateState,
  networkSettingsUpdateSuccess,
  reloadWalletRequested,
  types
} from '../actions';
import { HTTP_REQUEST_TIMEOUT, NETWORK, networkSettingsKeyMap, NETWORK_TESTNET, STAGE, STAGE_DEV_PRIVNET, STAGE_TESTNET, WALLET_SERVICE_REQUEST_TIMEOUT } from '../constants';
import { getFullnodeNetwork, getWalletServiceNetwork } from './helpers';
import { STORE } from '../store';

/**
 * Initialize network settings saga.
 *
 * It looks up a stored network settings to update the redux state.
 */
export function* initNetworkSettings() {
  const customNetwork = STORE.getItem(networkSettingsKeyMap.networkSettings);
  if (customNetwork) {
    yield put(networkSettingsUpdateState(customNetwork));
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

  const errors = {};

  // validates input emptyness
  if (isEmpty(action.payload)) {
    errors.message = t`Custom Network Settings cannot be empty.`;
  }

  // validates explorerUrl
  // - required
  // - should have a valid URL
  if (isEmpty(explorerUrl) || invalidUrl(explorerUrl)) {
    errors.explorerUrl = t`explorerUrl should be a valid URL.`;
  }

  // validates explorerServiceUrl
  // - required
  // - should have a valid URL
  if (isEmpty(explorerServiceUrl) || invalidUrl(explorerServiceUrl)) {
    errors.explorerServiceUrl = t`explorerServiceUrl should be a valid URL.`;
  }

  // validates nodeUrl
  // - required
  // - should have a valid URl
  if (isEmpty(nodeUrl) || invalidUrl(nodeUrl)) {
    errors.nodeUrl = t`nodeUrl should be a valid URL.`;
  }

  // validates walletServiceUrl
  // - optional
  // - should have a valid URL, if given
  if (walletServiceUrl && invalidUrl(walletServiceUrl)) {
    errors.walletServiceUrl = t`walletServiceUrl should be a valid URL.`;
  }

  // validates walletServiceWsUrl
  // - conditionally required
  // - should have a valid URL, if walletServiceUrl is given
  if (walletServiceUrl && invalidUrl(walletServiceWsUrl)) {
    errors.walletServiceWsUrl = t`walletServiceWsUrl should be a valid URL.`;
  }

  // TODO: Refactor by segregating Failure from Errors
  // - create networkSettingsUpdateErrors
  // - implement reaction to networkSettingsUpdateFailure
  yield put(networkSettingsUpdateErrors(errors));
  if (Object.keys(errors).length > 0) {
    return;
  }

  // NOTE: Should we allow that all the URLs be equals?
  // In practice they will never be equals.

  const networkSettings = yield select((state) => state.networkSettings);
  const backupUrl = {
    nodeUrl: networkSettings.nodeUrl,
    explorerServiceUrl: networkSettings.explorerServiceUrl,
    walletServiceUrl: networkSettings.walletServiceUrl,
    walletServiceWsUrl: networkSettings.walletServiceWsUrl,
  };

  config.setExplorerServiceBaseUrl(explorerServiceUrl);
  config.setServerUrl(nodeUrl);

  // - walletServiceUrl has precedence
  // - nodeUrl as fallback
  let network;
  if (walletServiceUrl) {
    config.setWalletServiceBaseUrl(walletServiceUrl);
    config.setWalletServiceBaseWsUrl(walletServiceWsUrl);

    try {
      // continue if timeout
      const { response } = yield race({
        response: call(getWalletServiceNetwork),
        timeout: delay(WALLET_SERVICE_REQUEST_TIMEOUT),
      });

      if (response) {
        network = response;
      }
    } catch (err) {
      console.error('Error calling the wallet-service while trying to get network details in updateNetworkSettings effect.', err);
      rollbackConfigUrls(backupUrl);
    }
  }

  if (!network) {
    try {
      network = yield call(getFullnodeNetwork);
    } catch (err) {
      console.error('Error calling the fullnode while trying to get network details in updateNetworkSettings effect..', err);
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

  yield put(networkSettingsPersistStore(customNetwork));
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
 * @param {string} tryUrl to be checked.
 * @returns {boolean} true if invalid, false otherwise.
 */
function invalidUrl(tryUrl) {
  const urlTestPattern = /^(https?|wss?):\/\/[^\s/$.?#].[^\s]*$/;
  try {
    if (!urlTestPattern.test(tryUrl)) {
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
  try {
    STORE.setItem(networkSettingsKeyMap.networkSettings, networkSettings);
  } catch (err) {
    console.error('Error while persisting the custom network settings.', err);
    yield put(networkSettingsUpdateFailure());
    return;
  }

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

  yield put(networkSettingsUpdateReady());
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
    takeEvery(types.NETWORKSETTINGS_UPDATE_REQUEST, updateNetworkSettings),
    takeEvery(types.NETWORKSETTINGS_PERSIST_STORE, persistNetworkSettings),
    takeEvery(types.RESET_WALLET, cleanNetworkSettings),
  ]);
}
