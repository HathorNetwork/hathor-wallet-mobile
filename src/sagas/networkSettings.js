import { all, takeEvery, put, call, race, delay, select } from 'redux-saga/effects';
import { config } from '@hathor/wallet-lib';
import { isEmpty } from 'lodash';
import { t } from 'ttag';
import {
  networkSettingsPersistStore,
  networkSettingsUpdateInvalid,
  networkSettingsUpdateFailure,
  networkSettingsUpdateState,
  networkSettingsUpdateSuccess,
  networkSettingsUpdateWaiting,
  types,
  reloadWalletRequested,
  onExceptionCaptured,
  networkSettingsUpdateReady,
} from '../actions';
import {
  NETWORK_MAINNET,
  networkSettingsKeyMap,
  NETWORKSETTINGS_STATUS,
  NETWORK_TESTNET,
  STAGE,
  STAGE_DEV_PRIVNET,
  STAGE_TESTNET,
  WALLET_SERVICE_REQUEST_TIMEOUT,
  NETWORK_PRIVATENET,
} from '../constants';
import {
  getFullnodeNetwork,
  getWalletServiceNetwork,
} from './helpers';
import { STORE } from '../store';
import { isWalletServiceEnabled } from './wallet';
import { logger } from '../logger';

const log = logger('network-settings-saga');

/**
 * Initialize the network settings saga when the wallet starts successfully.
 */
export function* initNetworkSettings() {
  const customNetwork = STORE.getItem(networkSettingsKeyMap.networkSettings);
  if (customNetwork) {
    yield put(networkSettingsUpdateState(customNetwork));
  }

  const status = yield select((state) => state.networkSettingsStatus);
  if (status === NETWORKSETTINGS_STATUS.WAITING) {
    // This branch completes the network update by delivering
    // a success feedback to the user.
    yield put(networkSettingsUpdateSuccess());
  } else {
    // This branch is a fallback to set network status to READY
    // after wallet initialization.
    yield put(networkSettingsUpdateReady());
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
    txMiningServiceUrl,
    walletServiceUrl,
    walletServiceWsUrl,
  } = action.payload || {};

  const invalidPayload = {};

  // validates input emptyness
  if (isEmpty(action.payload)) {
    invalidPayload.message = t`Custom Network Settings cannot be empty.`;
  }

  // validates explorerUrl
  // - required
  // - should have a valid URL
  if (isEmpty(explorerUrl) || invalidUrl(explorerUrl)) {
    invalidPayload.explorerUrl = t`explorerUrl should be a valid URL.`;
  }

  // validates explorerServiceUrl
  // - required
  // - should have a valid URL
  if (isEmpty(explorerServiceUrl) || invalidUrl(explorerServiceUrl)) {
    invalidPayload.explorerServiceUrl = t`explorerServiceUrl should be a valid URL.`;
  }

  // validates txMiningServiceUrl
  // - required
  // - should have a valid URL
  if (isEmpty(txMiningServiceUrl) || invalidUrl(txMiningServiceUrl)) {
    invalidPayload.txMiningServiceUrl = t`txMiningServiceUrl should be a valid URL.`;
  }

  // validates nodeUrl
  // - required
  // - should have a valid URl
  if (isEmpty(nodeUrl) || invalidUrl(nodeUrl)) {
    invalidPayload.nodeUrl = t`nodeUrl should be a valid URL.`;
  }

  // validates walletServiceUrl
  // - optional
  // - should have a valid URL, if given
  if (walletServiceUrl && invalidUrl(walletServiceUrl)) {
    invalidPayload.walletServiceUrl = t`walletServiceUrl should be a valid URL.`;
  }

  // validates walletServiceWsUrl
  // - conditionally required
  // - should have a valid URL, if walletServiceUrl is given
  if (walletServiceUrl && invalidUrl(walletServiceWsUrl)) {
    invalidPayload.walletServiceWsUrl = t`walletServiceWsUrl should be a valid URL.`;
  }

  yield put(networkSettingsUpdateInvalid(invalidPayload));
  if (Object.keys(invalidPayload).length > 0) {
    log.debug('Invalid request to update network settings.');
    return;
  }

  // NOTE: Should we allow that all the URLs be equals?
  // In practice they will never be equals.

  const networkSettings = yield select((state) => state.networkSettings);
  const useWalletService = yield call(isWalletServiceEnabled);
  const backupUrl = {
    nodeUrl: networkSettings.nodeUrl,
    explorerServiceUrl: networkSettings.explorerServiceUrl,
    walletServiceUrl: networkSettings.walletServiceUrl,
    walletServiceWsUrl: networkSettings.walletServiceWsUrl,
    txMiningServiceUrl: networkSettings.txMiningServiceUrl,
  };

  config.setExplorerServiceBaseUrl(explorerServiceUrl);
  config.setServerUrl(nodeUrl);
  config.setTxMiningUrl(txMiningServiceUrl);

  // - walletServiceUrl has precedence
  // - nodeUrl as fallback
  let potentialNetwork;
  let network;
  if (walletServiceUrl && useWalletService) {
    log.debug('Configuring wallet-service on custom network settings.');
    config.setWalletServiceBaseUrl(walletServiceUrl);
    config.setWalletServiceBaseWsUrl(walletServiceWsUrl);

    try {
      // continue if timeout
      const { response } = yield race({
        response: call(getWalletServiceNetwork),
        timeout: delay(WALLET_SERVICE_REQUEST_TIMEOUT),
      });

      if (response) {
        potentialNetwork = response;
      }
    } catch (err) {
      log.error('Error calling the wallet-service while trying to get network details in updateNetworkSettings effect.', err);
      rollbackConfigUrls(backupUrl);
    }
  }

  if (!potentialNetwork) {
    try {
      potentialNetwork = yield call(getFullnodeNetwork);
    } catch (err) {
      log.error('Error calling the fullnode while trying to get network details in updateNetworkSettings effect..', err);
      rollbackConfigUrls(backupUrl);
      yield put(networkSettingsUpdateFailure());
      return;
    }
  }

  // Fail after try get network from fullnode
  if (!potentialNetwork) {
    log.debug('The network could not be found.');
    yield put(networkSettingsUpdateFailure());
    return;
  }

  // Validates the potential network and set the network accordingly
  if (potentialNetwork === NETWORK_MAINNET) {
    network = NETWORK_MAINNET;
  } else if (potentialNetwork.startsWith(NETWORK_TESTNET)) {
    network = NETWORK_TESTNET;
  } else if (potentialNetwork.startsWith(NETWORK_PRIVATENET)) {
    network = NETWORK_PRIVATENET;
  } else {
    log.debug('The network informed is not allowed. Make sure your network is either "mainnet", "testnet" or "privatenet", or starts with "testnet" or "privatenet".');
    yield put(networkSettingsUpdateFailure());
    return;
  }

  let stage;
  if (network === NETWORK_MAINNET) {
    stage = STAGE;
  } else if (network === NETWORK_TESTNET) {
    stage = STAGE_TESTNET;
  } else {
    stage = STAGE_DEV_PRIVNET;
  }

  const customNetwork = {
    stage,
    network,
    nodeUrl,
    explorerUrl,
    explorerServiceUrl,
    txMiningServiceUrl,
    walletServiceUrl,
    walletServiceWsUrl,
  };

  log.debug('Success updading network settings.');
  yield put(networkSettingsPersistStore(customNetwork));
}

/**
 * Rollback the URLs configured in the wallet by using the backupUrl object.
 * @param {{
 *   nodeUrl: string;
 *   explorerServiceUrl: string;
 *   txMiningServiceUrl: string;
 *   walletServiceUrl: string;
 *   walletServiceWsUrl: string;
 * }} backupUrl An object containing the previous configuration for wallet URLs.
 */
function rollbackConfigUrls(backupUrl) {
  config.setServerUrl(backupUrl.nodeUrl);
  config.setExplorerServiceBaseUrl(backupUrl.explorerServiceUrl);
  config.setTxMiningUrl(backupUrl.txMiningServiceUrl);
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
    yield put(networkSettingsUpdateWaiting());
  } catch (err) {
    console.error('Error while persisting the custom network settings.', err);
    yield put(networkSettingsUpdateFailure());
    return;
  }

  const wallet = yield select((state) => state.wallet);
  if (!wallet) {
    // If we fall into this situation, the app should be killed
    // for the custom new network settings take effect.
    const errMsg = t`Wallet not found while trying to persist the custom network settings.`;
    console.warn(errMsg);
    yield put(onExceptionCaptured(errMsg, /* isFatal */ true));
    return;
  }

  // Stop wallet and clean its storage without clean its access data.
  wallet.stop({ cleanStorage: true, cleanAddresses: true, cleanTokens: true });
  // This action should clean the tokens history on redux.
  // In addition, the reload also clean the inmemory storage.
  yield put(reloadWalletRequested());
}

/**
 * Deletes the network settings from the application storage.
 */
export function* cleanNetworkSettings() {
  try {
    STORE.removeItem(networkSettingsKeyMap.networkSettings);
  } catch (err) {
    console.error('Error while deleting the custom network settings from app storage.', err);
    yield 1;
  }
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
