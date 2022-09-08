import { NativeModules } from 'react-native';
import {
  Connection,
  HathorWallet,
  HathorWalletServiceWallet,
  Network,
  wallet as walletUtil,
  tokens as tokensUtils,
  constants as hathorLibConstants,
  metadataApi,
  config,
} from '@hathor/wallet-lib';
import {
  takeLatest,
  takeEvery,
  select,
  all,
  put,
  call,
  race,
  take,
  fork,
} from 'redux-saga/effects';
import { chunk } from 'lodash';
import { eventChannel } from 'redux-saga';
import { getUniqueId } from 'react-native-device-info';
import { t } from 'ttag';
import {
  STORE,
  DEFAULT_TOKEN,
  METADATA_CONCURRENT_DOWNLOAD,
  WALLET_SERVICE_MAINNET_BASE_WS_URL,
  WALLET_SERVICE_MAINNET_BASE_URL,
} from '../constants';
import { FeatureFlags } from '../featureFlags';
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
  setServerInfo,
  setIsOnline,
  setWallet,
  newTx,
  types,
} from '../actions';
import {
  specificTypeAndPayload,
} from './helpers';
import NavigationService from '../NavigationService';
import { setKeychainPin } from '../utils';

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
      beforeReloadCallback: () => emitter(onStartWalletLock()),
    };
    wallet = new HathorWallet(walletConfig);
  }

  yield put(setWallet(wallet));

  // Setup listeners before starting the wallet so we don't lose messages
  yield fork(setupWalletListeners, wallet);

  // Create a channel to listen for the ready state and
  // wait until the wallet is ready
  yield fork(listenForWalletReady, wallet);

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

      // Restart the whole bundle to make sure we clear all events
      NativeModules.HTRReloadBundleModule.restart();
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
      success: take('WALLET_STATE_READY'),
      error: take(types.WALLET_STATE_ERROR),
    });

    if (error) {
      yield put(startWalletFailed());
      return;
    }
  }

  yield call(loadTokens);
  yield fork(listenForFeatureFlags, featureFlags);
}

/**
 * This saga will load both HTR and DEFAULT_TOKEN (if they are different)
 * and dispatch actions to asynchronously load all registered tokens
 */
export function* loadTokens() {
  // Since we are reloading the token balances and history for HTR and DEFAULT_TOKEN,
  // we should display the loading history screen, as the current balance is now unreliable
  yield put(onStartWalletLock());

  const customTokenUid = DEFAULT_TOKEN.uid;
  const htrUid = hathorLibConstants.HATHOR_TOKEN_CONFIG.uid;

  // Download hathor token balance
  yield put(tokenFetchBalanceRequested(hathorLibConstants.HATHOR_TOKEN_CONFIG.uid));
  yield take(specificTypeAndPayload(types.TOKEN_FETCH_BALANCE_SUCCESS, { tokenId: htrUid }));
  // ...and history
  yield put(tokenFetchHistoryRequested(hathorLibConstants.HATHOR_TOKEN_CONFIG.uid));
  yield take(specificTypeAndPayload(types.TOKEN_FETCH_HISTORY_SUCCESS, { tokenId: htrUid }));

  if (customTokenUid !== htrUid) {
    // Download custom token balance
    yield put(tokenFetchBalanceRequested(customTokenUid));
    yield take(
      specificTypeAndPayload(types.TOKEN_FETCH_BALANCE_SUCCESS, {
        tokenId: customTokenUid,
      }),
    );
    // ...and history
    yield put(tokenFetchHistoryRequested(customTokenUid));
    yield take(
      specificTypeAndPayload(types.TOKEN_FETCH_HISTORY_SUCCESS, {
        tokenId: customTokenUid,
      }),
    );
  }

  // Hide the loading history screen
  yield put(startWalletSuccess());

  const registeredTokens = tokensUtils
    .getTokens()
    .reduce((acc, token) => {
      // remove htr since we will always download the HTR token
      if (token.uid === '00') {
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
}

/**
 * Fetch a single token from the metadataApi
 *
 * @param {Array} token The token to fetch from the metadata api
 * @param {String} network Network name
 *
 * @memberof Wallet
 * @inner
 */
export async function fetchTokenMetadata(token, network) {
  if (token === hathorLibConstants.HATHOR_TOKEN_CONFIG.uid) {
    return {};
  }

  const metadataPerToken = {};

  try {
    const data = await metadataApi.getDagMetadata(
      token,
      network,
    );

    // When the getDagMetadata method returns null
    // it means that we have no metadata for this token
    if (data) {
      const tokenMeta = data[token];
      metadataPerToken[token] = tokenMeta;
    }
  } catch (e) {
    // Error downloading metadata, then we should wait a few seconds
    // and retry if still didn't reached retry limit
    // eslint-disable-next-line
    console.log('Error downloading metadata of token', token);
  }

  return metadataPerToken;
}

/**
 * The wallet needs each token metadata to show information correctly
 * So we fetch the tokens metadata and store on redux
 */
export function* fetchTokensMetadata(tokens) {
  const { network } = yield select((state) => state.serverInfo);

  const tokenChunks = chunk(tokens, METADATA_CONCURRENT_DOWNLOAD);

  let tokenMetadatas = {};
  for (const tokenChunk of tokenChunks) {
    const responses = yield all(tokenChunk.map((token) => fetchTokenMetadata(token, network)));
    for (const response of responses) {
      tokenMetadatas = {
        ...tokenMetadatas,
        ...response,
      };
    }
  }

  yield put(tokenMetadataUpdated(tokenMetadatas));
}

// This will create a channel to listen for featureFlag updates
export function* listenForFeatureFlags(featureFlags) {
  const channel = eventChannel((emitter) => {
    const listener = (state) => emitter(state);
    featureFlags.on('wallet-service-enabled', (state) => {
      emitter(state);
    });

    // Cleanup when the channel is closed
    return () => {
      featureFlags.removeListener('wallet-service-enabled', listener);
    };
  });

  try {
    while (true) {
      const newUseWalletService = yield take(channel);
      const oldUseWalletService = yield select((state) => state.useWalletService);

      if (oldUseWalletService && oldUseWalletService !== newUseWalletService) {
        NativeModules.HTRReloadBundleModule.restart();
      }
    }
  } finally {
    // When we close the channel, it will remove the event listener
    channel.close();
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
        break;
      } else {
        if (wallet.isReady()) {
          yield put(walletStateReady());
          break;
        }

        continue;
      }
    }
  } finally {
    // When we close the channel, it will remove the event listener
    channel.close();
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

/**
 * This will receive a channel and simply dispatch actions that are emmited from
 * it. The idea here is to capture events that are emitted from inside a callback,
 * this is used for the `beforeReloadCallback` and the showPinScreenForResult callback
 */
export function* setupWalletEvents(channel) {
  while (true) {
    const action = yield take(channel);
    yield put(action);
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
    wallet.on('reload-data', () => emitter({
      type: 'WALLET_RELOAD_DATA',
    }));
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
    channel.close();
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

  if (walletStartState === 'loading') {
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

export function* reloadData() {
  yield call(loadTokens);
  yield put(startWalletSuccess());
}

export function* saga() {
  yield all([
    takeLatest('START_WALLET_REQUESTED', startWallet),
    takeLatest('WALLET_CONN_STATE_UPDATE', onWalletConnStateUpdate),
    takeEvery('WALLET_NEW_TX', handleTx),
    takeEvery('WALLET_UPDATE_TX', handleTx),
    takeEvery('WALLET_BEST_BLOCK_UPDATE', bestBlockUpdate),
    takeEvery('WALLET_PARTIAL_UPDATE', loadPartialUpdate),
    takeEvery('WALLET_RELOAD_DATA', reloadData),
  ]);
}
