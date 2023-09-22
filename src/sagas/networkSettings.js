import { all, takeEvery, put, call, race, take, delay } from 'redux-saga/effects';
import { config } from '@hathor/wallet-lib';
import { isEmpty } from 'lodash';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { featureToggleUpdate, networkSettingsUpdateFailure, networkSettingsUpdateSuccess, reloadWalletRequested, types } from '../actions';
import { HTTP_REQUEST_TIMEOUT, NETWORK, networkSettingsKey, NETWORK_TESTNET, STAGE, STAGE_DEV_PRIVNET, STAGE_TESTNET } from '../constants';
import { getFullnodeNetwork, getWalletServiceNetwork } from './helpers';
import { STORE } from '../store';

export function* updateNetworkSettings(action) {
  const {
    nodeUrl,
    explorerUrl,
    walletServiceUrl,
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

  // NOTE: Should we allow that all the URLs be equals?
  // In practice they will never be equals.

  const oldExplorerUrl = config.getExplorerServiceBaseUrl();
  const oldNodeUrl = config.getServerUrl();
  const oldWalletServiceUrl = config.getWalletServiceBaseUrl();
  const oldWalletServiceWsUrl = config.getWalletServiceBaseWsUrl();

  config.setExplorerServiceBaseUrl(explorerUrl);
  config.setServerUrl(nodeUrl);

  // TODO: get network as the best effort
  // - walletServiceUrl has precedence
  // - nodeUrl as fallback

  let network;
  let walletServiceWsUrl;
  if (walletServiceUrl) {
    const _url = new URL(walletServiceUrl);
    if (_url.protocol.includes('https')) {
      walletServiceWsUrl = `wss://ws.${_url.host}${_url.pathname}`;
    } else {
      walletServiceWsUrl = `ws://ws.${_url.host}${_url.pathname}`;
    }

    config.setWalletServiceBaseUrl(walletServiceUrl);
    config.setWalletServiceBaseWsUrl(walletServiceWsUrl);

    try {
      network = yield call(getWalletServiceNetwork);
    } catch (err) {
      // rollback config
      config.setExplorerServiceBaseUrl(oldExplorerUrl);
      config.setServerUrl(oldNodeUrl);
      config.setWalletServiceBaseUrl(oldWalletServiceUrl);
      config.setWalletServiceBaseWsUrl(oldWalletServiceWsUrl);
      yield put(networkSettingsUpdateFailure());
      return;
    }
  }

  if (!network) {
    try {
      network = yield call(getFullnodeNetwork);
    } catch (err) {
      // rollback config
      config.setExplorerServiceBaseUrl(oldExplorerUrl);
      config.setServerUrl(oldNodeUrl);
      config.setWalletServiceBaseUrl(oldWalletServiceUrl);
      config.setWalletServiceBaseWsUrl(oldWalletServiceWsUrl);
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
    walletServiceUrl,
    walletServiceWsUrl,
    nodeUrl,
    explorerUrl,
  };

  yield put(networkSettingsUpdateSuccess(customNetwork));
}

function invalidUrl(value) {
  const allowedProtocols = ['http:', 'https:'];
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

export function* persistNetworkSettings(action) {
  // persists after reducer being updated
  const networkSettings = action.payload;
  const strNetworkSettings = JSON.stringify(networkSettings);
  yield call(AsyncStorage.setItem, networkSettingsKey.networkSettings, strNetworkSettings);

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

export function* cleanNetworkSettings() {
  STORE.removeItem(networkSettingsKey.networkSettings);
  yield 0;
}

export function* saga() {
  yield all([
    takeEvery(types.NETWORKSETTINGS_UPDATE, updateNetworkSettings),
    takeEvery(types.NETWORKSETTINGS_UPDATE_SUCCESS, persistNetworkSettings),
    takeEvery(types.RESET_WALLET, cleanNetworkSettings),
  ]);
}
