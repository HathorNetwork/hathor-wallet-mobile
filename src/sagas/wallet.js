/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NativeModules } from 'react-native';
import {
  Connection,
  HathorWallet,
  HathorWalletServiceWallet,
  Network,
  wallet as walletUtil,
  tokens as tokensUtils,
  constants as hathorLibConstants,
  config,
} from '@hathor/wallet-lib';
import {
  takeLatest,
  takeEvery,
  select,
  cancel,
  cancelled,
  all,
  put,
  call,
  race,
  take,
  fork,
} from 'redux-saga/effects';
import { eventChannel } from 'redux-saga';
import { getUniqueId } from 'react-native-device-info';
import { t } from 'ttag';
import {
  STORE,
  DEFAULT_TOKEN,
  WALLET_SERVICE_MAINNET_BASE_WS_URL,
  WALLET_SERVICE_MAINNET_BASE_URL,
} from '../constants';
import {
  Events as FeatureFlagEvents,
  FeatureFlags,
} from '../featureFlags';
import {
  tokenFetchBalanceRequested,
  tokenFetchHistoryRequested,
  tokenInvalidateHistory,
  setIsShowingPinScreen,
  tokenMetadataUpdated,
  setUseWalletService,
  onStartWalletLock,
  startWalletSuccess,
  startWalletFailed,
  setUniqueDeviceId,
  updateLoadedData,
  walletStateReady,
  walletStateError,
  onWalletReload,
  setServerInfo,
  setIsOnline,
  setWallet,
  newTx,
  types,
} from '../actions';
import { fetchTokenData } from './tokens';
import { specificTypeAndPayload } from './helpers';
import NavigationService from '../NavigationService';
import { setKeychainPin } from '../utils';

export const WALLET_STATUS = {
  READY: 'ready',
  FAILED: 'failed',
  LOADING: 'loading',
};

export function* startWallet(action) {
  const { words, pin } = action.payload;

  const networkName = 'mainnet';
  const uniqueDeviceId = getUniqueId();
  const featureFlags = new FeatureFlags(uniqueDeviceId, networkName);
  const useWalletService = yield call(() => featureFlags.shouldUseWalletService());

  yield put(setUseWalletService(useWalletService));

  // If we've lost redux data, we could not properly stop the wallet object
  // then we don't know if we've cleaned up the wallet data in the storage
  walletUtil.cleanLoadedData();

  // This is a work-around so we can dispatch actions from inside callbacks.
  let dispatch;
  yield put((_dispatch) => {
    dispatch = _dispatch;
  });

  const showPinScreenForResult = async () => new Promise((resolve) => {
    const params = {
      cb: (_pin) => {
        dispatch(setIsShowingPinScreen(false));
        resolve(_pin);
      },
      canCancel: false,
      screenText: t`Enter your 6-digit pin to authorize operation`,
      biometryText: t`Authorize operation`,
    };

    NavigationService.navigate('PinScreen', params);

    // We should set the global isShowingPinScreen
    dispatch(setIsShowingPinScreen(true));
  });

  let wallet;
  if (useWalletService) {
    const network = new Network(networkName);

    // Set urls for wallet service
    config.setWalletServiceBaseUrl(WALLET_SERVICE_MAINNET_BASE_URL);
    config.setWalletServiceBaseWsUrl(WALLET_SERVICE_MAINNET_BASE_WS_URL);

    wallet = new HathorWalletServiceWallet({
      requestPassword: showPinScreenForResult,
      seed: words,
      network
    });
  } else {
    const connection = new Connection({
      network: networkName, // app currently connects only to mainnet
      servers: ['https://mobile.wallet.hathor.network/v1a/'],
    });

    const walletConfig = {
      seed: words,
      store: STORE,
      connection,
      beforeReloadCallback: () => {
        dispatch(onWalletReload());
      },
    };
    wallet = new HathorWallet(walletConfig);
  }

  yield put(setWallet(wallet));

  // Setup listeners before starting the wallet so we don't lose messages
  const walletListenerThread = yield fork(setupWalletListeners, wallet);

  // Create a channel to listen for the ready state and
  // wait until the wallet is ready
  const walletReadyThread = yield fork(listenForWalletReady, wallet);

  // Thread to listen for feature flags from Unleash
  const featureFlagsThread = yield fork(listenForFeatureFlags, featureFlags);

  const threads = [
    walletListenerThread,
    walletReadyThread,
    featureFlagsThread
  ];

  // Store the unique device id on redux
  yield put(setUniqueDeviceId(uniqueDeviceId));

  try {
    yield call(wallet.start.bind(wallet), {
      pinCode: pin,
      password: pin,
    });
  } catch (e) {
    if (useWalletService) {
      // Wallet Service start wallet will fail if the status returned from
      // the service is 'error' or if the start wallet request failed.
      // We should fallback to the old facade by storing the flag to ignore
      // the feature flag
      yield call(featureFlags.ignoreWalletServiceFlag.bind(featureFlags));

      // Cleanup all listeners
      yield cancel(threads);

      // Yield the same action so it will now load on the old facade
      yield put(action);
    }
  }

  walletUtil.storePasswordHash(pin);
  walletUtil.storeEncryptedWords(words, pin);
  setKeychainPin(pin);

  yield put(setServerInfo({
    version: null,
    network: networkName,
  }));

  // Wallet might be already ready at this point
  if (!wallet.isReady()) {
    const { error } = yield race({
      success: take(types.WALLET_STATE_READY),
      error: take(types.WALLET_STATE_ERROR),
    });

    if (error) {
      yield put(startWalletFailed());
      return;
    }
  }

  try {
    yield call(loadTokens);
  } catch (e) {
    console.error('Tokens load failed: ', e);
    yield put(startWalletFailed());
    return;
  }

  yield put(startWalletSuccess());

  // The way the redux-saga fork model works is that if a saga has `forked`
  // another saga (using the `fork` effect), it will remain active until all
  // the forks are terminated. You can read more details at
  // https://redux-saga.js.org/docs/advanced/ForkModel
  // So, if a new START_WALLET_REQUESTED action is dispatched, we need to cleanup
  // all attached forks (that will cause the event listeners to be cleaned).
  yield take('START_WALLET_REQUESTED');
  yield cancel(threads);
}

/**
 * This saga will load both HTR and DEFAULT_TOKEN (if they are different)
 * and dispatch actions to asynchronously load all registered tokens.
 *
 * Will throw an error if the download fails for any token.
 */
export function* loadTokens() {
  const customTokenUid = DEFAULT_TOKEN.uid;
  const htrUid = hathorLibConstants.HATHOR_TOKEN_CONFIG.uid;

  // fetchTokenData will throw an error if the download failed, we should just
  // let it crash as throwing an error is the default behavior for loadTokens
  yield call(fetchTokenData, htrUid);

  if (customTokenUid !== htrUid) {
    yield call(fetchTokenData, customTokenUid);
  }

  const registeredTokens = tokensUtils
    .getTokens()
    .reduce((acc, token) => {
      // remove htr since we will always download the HTR token
      if (token.uid === htrUid) {
        return acc;
      }

      return [...acc, token.uid];
    }, []);

  // We don't need to wait for the metadatas response, so just fork it
  yield fork(fetchTokensMetadata, registeredTokens);

  // Since we already know here what tokens are registered, we can dispatch actions
  // to asynchronously load the balances of each one. The `put` effect will just dispatch
  // and continue, loading the tokens asynchronously
  for (const token of registeredTokens) {
    yield put(tokenFetchBalanceRequested(token));
  }

  return registeredTokens;
}

/**
 * The wallet needs each token metadata to show information correctly
 * So we fetch the tokens metadata and store on redux
 */
export function* fetchTokensMetadata(tokens) {
  // No tokens to load
  if (!tokens.length) {
    return;
  }

  for (const token of tokens) {
    yield put({
      type: types.TOKEN_FETCH_METADATA_REQUESTED,
      tokenId: token,
    });
  }

  const responses = yield all(
    tokens.map((token) => take(
      specificTypeAndPayload([
        types.TOKEN_FETCH_METADATA_SUCCESS,
        types.TOKEN_FETCH_METADATA_FAILED,
      ], {
        tokenId: token,
      }),
    ))
  );

  const tokenMetadatas = {};
  for (const response of responses) {
    if (response.type === types.TOKEN_FETCH_METADATA_FAILED) {
      // eslint-disable-next-line
      console.log('Error downloading metadata of token', response.tokenId);
    } else if (response.type === types.TOKEN_FETCH_METADATA_SUCCESS) {
      // When the request returns null, it means that we have no metadata for this token
      if (response.data) {
        tokenMetadatas[response.tokenId] = response.data;
      }
    }
  }

  yield put(tokenMetadataUpdated(tokenMetadatas));
}

// This will create a channel to listen for featureFlag updates
export function* listenForFeatureFlags(featureFlags) {
  const channel = eventChannel((emitter) => {
    const listener = (state) => emitter(state);
    featureFlags.on(FeatureFlagEvents.WALLET_SERVICE_ENABLED, (state) => {
      emitter(state);
    });

    // Cleanup when the channel is closed
    return () => {
      featureFlags.removeListener(FeatureFlagEvents.WALLET_SERVICE_ENABLED, listener);
    };
  });

  try {
    while (true) {
      const newUseWalletService = yield take(channel);
      const oldUseWalletService = yield select((state) => state.useWalletService);

      if (oldUseWalletService !== newUseWalletService) {
        NativeModules.HTRReloadBundleModule.restart();
      }
    }
  } finally {
    if (yield cancelled()) {
      // When we close the channel, it will remove the event listener
      channel.close();
    }
  }
}

// This will create a channel from an EventEmitter to wait until the wallet is loaded,
// dispatching actions
export function* listenForWalletReady(wallet) {
  const channel = eventChannel((emitter) => {
    const listener = (state) => emitter(state);
    wallet.on('state', (state) => emitter(state));

    // Cleanup when the channel is closed
    return () => {
      wallet.removeListener('state', listener);
    };
  });

  try {
    while (true) {
      const message = yield take(channel);

      if (message === HathorWallet.ERROR) {
        yield put(walletStateError());
        yield cancel();
      } else {
        if (wallet.isReady()) {
          yield put(walletStateReady());
          yield cancel();
        }

        continue;
      }
    }
  } finally {
    if (yield cancelled()) {
      // When we close the channel, it will remove the event listener
      channel.close();
    }
  }
}

export function* handleTx(action) {
  const tx = action.payload;
  const wallet = yield select((state) => state.wallet);

  if (!wallet.isReady()) {
    return;
  }

  // find tokens affected by the transaction
  const balances = yield call(wallet.getTxBalance.bind(wallet), tx);
  const stateTokens = yield select((state) => state.tokens);
  const registeredTokens = stateTokens.map((token) => token.uid);

  // We should download the **balance** for every token involved in the transaction
  // and history for hathor and DEFAULT_TOKEN
  for (const [tokenUid] of Object.entries(balances)) {
    if (registeredTokens.indexOf(tokenUid) === -1) {
      continue;
    }
    yield put(tokenFetchBalanceRequested(tokenUid, true));

    if (tokenUid === hathorLibConstants.HATHOR_TOKEN_CONFIG.uid
        || tokenUid === DEFAULT_TOKEN.uid) {
      yield put(tokenFetchHistoryRequested(tokenUid, true));
    } else {
      // Invalidate the history so it will get requested the next time
      // the user enters the history screen
      yield put(tokenInvalidateHistory(tokenUid));
    }
  }

  // If this is a new tx, we should dispatch newTx
  if (action.type === 'WALLET_NEW_TX') {
    yield put(newTx(tx));
  }
}

export function* setupWalletListeners(wallet) {
  const channel = eventChannel((emitter) => {
    const listener = (state) => emitter(state);
    wallet.conn.on('best-block-update', (blockHeight) => emitter({
      type: 'WALLET_BEST_BLOCK_UPDATE',
      data: blockHeight,
    }));
    wallet.conn.on('wallet-load-partial-update', (data) => emitter({
      type: 'WALLET_PARTIAL_UPDATE',
      data,
    }));
    wallet.conn.on('state', (state) => emitter({
      type: 'WALLET_CONN_STATE_UPDATE',
      data: state,
    }));
    wallet.on('reload-data', () => emitter(onWalletReload()));
    wallet.on('update-tx', (data) => emitter({
      type: 'WALLET_UPDATE_TX',
      data,
    }));
    wallet.on('new-tx', (data) => emitter({
      type: 'WALLET_NEW_TX',
      data,
    }));

    return () => {
      wallet.conn.removeListener('best-block-update', listener);
      wallet.conn.removeListener('wallet-load-partial-update', listener);
      wallet.conn.removeListener('state', listener);
      wallet.removeListener('reload-data', listener);
      wallet.removeListener('update-tx', listener);
      wallet.removeListener('new-tx', listener);
    };
  });

  try {
    while (true) {
      const message = yield take(channel);

      yield put({
        type: message.type,
        payload: message.data,
      });
    }
  } finally {
    if (yield cancelled()) {
      // When we close the channel, it will remove the event listener
      channel.close();
    }
  }
}

export function* loadPartialUpdate({ payload }) {
  const transactions = Object.keys(payload.historyTransactions).length;
  const addresses = payload.addressesFound;
  yield put(updateLoadedData({ transactions, addresses }));
}

export function* bestBlockUpdate({ payload }) {
  const currentHeight = yield select((state) => state.height);
  const walletStartState = yield select((state) => state.walletStartState);
  const wallet = yield select((state) => state.wallet);

  if (!wallet.isReady()) {
    return;
  }

  if (walletStartState === WALLET_STATUS.LOADING) {
    return;
  }

  if (currentHeight !== payload) {
    yield put(tokenFetchBalanceRequested(hathorLibConstants.HATHOR_TOKEN_CONFIG.uid));
  }
}

export function* onWalletConnStateUpdate({ payload }) {
  const isOnline = payload === Connection.CONNECTED;

  yield put(setIsOnline(isOnline));
}

export function* onWalletReloadData() {
  yield put(onStartWalletLock());

  const wallet = yield select((state) => state.wallet);

  // Since we close the channel after a walletReady event is received,
  // we must fork this saga again so we setup listeners again.
  yield fork(listenForWalletReady, wallet);

  // Wait until the wallet is ready
  yield take(types.WALLET_STATE_READY);

  try {
    const registeredTokens = yield call(loadTokens);

    const customTokenUid = DEFAULT_TOKEN.uid;
    const htrUid = hathorLibConstants.HATHOR_TOKEN_CONFIG.uid;

    // We might have lost transactions during the reload, so we must invalidate the
    // token histories:
    for (const tokenUid of registeredTokens) {
      // Skip customtoken and HTR since we already force-download the history on loadTokens
      if (tokenUid === htrUid
          || tokenUid === customTokenUid) {
        continue;
      }

      yield put(tokenInvalidateHistory(tokenUid));
    }
    yield put(startWalletSuccess());
  } catch (e) {
    yield put(startWalletFailed());
  }
}

export function* saga() {
  yield all([
    takeLatest('START_WALLET_REQUESTED', startWallet),
    takeLatest('WALLET_CONN_STATE_UPDATE', onWalletConnStateUpdate),
    takeLatest('WALLET_RELOADING', onWalletReloadData),
    takeEvery('WALLET_NEW_TX', handleTx),
    takeEvery('WALLET_UPDATE_TX', handleTx),
    takeEvery('WALLET_BEST_BLOCK_UPDATE', bestBlockUpdate),
    takeEvery('WALLET_PARTIAL_UPDATE', loadPartialUpdate),
  ]);
}
