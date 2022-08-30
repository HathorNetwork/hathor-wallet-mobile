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
  delay,
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
  METADATA_CONCURRENT_DOWNLOAD,
  WALLET_SERVICE_MAINNET_BASE_WS_URL,
  WALLET_SERVICE_MAINNET_BASE_URL,
} from '../constants';
import { FeatureFlags } from '../featureFlags';
import {
  tokenFetchBalanceRequested,
  tokenFetchHistoryRequested,
  tokenInvalidateHistory,
  setUseWalletService,
  onStartWalletLock,
  startWalletSuccess,
  startWalletFailed,
  setUniqueDeviceId,
  updateLoadedData,
  walletStateReady,
  walletStateError,
  setIsOnline,
  setWallet,
  types,
} from '../actions';
import {
  specificTypeAndPayload,
} from './helpers';
import NavigationService from '../NavigationService';


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

  const showPinScreenForResult = async () => new Promise((resolve) => {
    const params = {
      cb: (_pin) => {
        resolve(_pin);
      },
      canCancel: false,
      screenText: t`Enter your 6-digit pin to authorize operation`,
      biometryText: t`Authorize operation`,
    };

    NavigationService.navigate('PinScreen', params);
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

    const beforeReloadCallback = () => {
      // dispatch(fetchHistoryBegin());
    };

    const walletConfig = {
      seed: words,
      store: STORE,
      connection,
      beforeReloadCallback
    };
    wallet = new HathorWallet(walletConfig);
  }

  yield put(setWallet(wallet));

  // Setup listeners before starting the wallet so we don't lose messages
  yield fork(setupWalletListeners, wallet);
  yield wallet.start({ pinCode: pin, password: pin });

  // Fetch registered tokens metadata
  yield put({ type: 'LOAD_TOKEN_METADATA_REQUESTED' });

  // Store the unique device id on redux
  yield put(setUniqueDeviceId(uniqueDeviceId));

  // Create a channel to listen for the ready state and
  // wait until the wallet is ready
  yield fork(listenForWalletReady, wallet);
  const { error } = yield race({
    success: take(types.WALLET_STATE_READY),
    error: take(types.WALLET_STATE_ERROR),
  });

  if (error) {
    return yield put(startWalletFailed());
  }

  yield call(loadTokens);
  yield put(startWalletSuccess());
}

export function* loadTokens() {
  const customTokenUid = DEFAULT_TOKEN.uid;
  const htrUid = hathorLibConstants.HATHOR_TOKEN_CONFIG.uid;

  // Download hathor token balance
  yield put(tokenFetchBalanceRequested(hathorLibConstants.HATHOR_TOKEN_CONFIG.uid));
  yield take(specificTypeAndPayload(types.TOKEN_FETCH_BALANCE_SUCCESS, { tokenId: htrUid }));
  // .. and history
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
    // .. and history
    yield put(tokenFetchHistoryRequested(customTokenUid));
    yield take(
      specificTypeAndPayload(types.TOKEN_FETCH_HISTORY_SUCCESS, {
        tokenId: customTokenUid,
      }),
    );
  }

  const registeredTokens = tokensUtils
    .getTokens()
    .reduce((acc, token) => {
      // remove htr since we will always download the HTR token
      if (token.uid === '00') {
        return acc;
      }

      return [...acc, token.uid];
    }, []);

  // Since we already know here what tokens are registered, we can dispatch actions
  // to asynchronously load the balances of each one. The `put` effect will just dispatch
  // and continue, loading the tokens asynchronously
  for (const token of registeredTokens) {
    yield put(tokenFetchBalanceRequested(token));
  }
}

// This will create a channel from an EventEmitter to wait until the wallet is loaded,
// dispatching actions
export function* listenForWalletReady(wallet) {
  const channel = eventChannel((emitter) => {
    const listener = (state) => emitter(state);
    wallet.on('state', (state) => {
      emitter(state);
    });

    // Cleanup when the channel is closed
    return () => {
      wallet.removeListener('state', listener);
    };
  });

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

  // When we close the channel, it will remove the event listener
  channel.close();
}

export function* handleNewTx(action) {
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
  yield put(onStartWalletLock());
  yield call(loadTokens);
  yield put(startWalletSuccess());
}

export function* saga() {
  yield all([
    takeLatest('START_WALLET_REQUESTED', startWallet),
    takeLatest('WALLET_CONN_STATE_UPDATE', onWalletConnStateUpdate),
    takeEvery('WALLET_NEW_TX', handleNewTx),
    takeEvery('WALLET_BEST_BLOCK_UPDATE', bestBlockUpdate),
    takeEvery('WALLET_PARTIAL_UPDATE', loadPartialUpdate),
    takeEvery('WALLET_RELOAD_DATA', reloadData),
  ]);
}
