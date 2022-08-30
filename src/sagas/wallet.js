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
  setUseWalletService,
  startWalletSuccess,
  startWalletFailed,
  setUniqueDeviceId,
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


function* startWallet(action) {
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

  yield fork(listenForWalletReady, wallet);
  yield put(setWallet(wallet));

  // Setup listeners before starting the wallet so we don't lose messages
  yield fork(setupWalletListeners, wallet);
  yield wallet.start({ pinCode: pin, password: pin });

  // Fetch registered tokens metadata
  yield put({ type: 'LOAD_TOKEN_METADATA_REQUESTED' });
  // Store the unique device id on redux
  yield put(setUniqueDeviceId(uniqueDeviceId));
  // Wait until the wallet is ready
  const { error } = yield race({
    success: take(types.WALLET_STATE_READY),
    error: take(types.WALLET_STATE_ERROR),
  });

  if (error) {
    return yield put(startWalletFailed());
  }
  // Wallet loaded succesfully here, we should load the hathor token balance and history
  yield put(tokenFetchBalanceRequested(hathorLibConstants.HATHOR_TOKEN_CONFIG.uid));
  yield put(tokenFetchHistoryRequested(hathorLibConstants.HATHOR_TOKEN_CONFIG.uid));

  const customTokenUid = DEFAULT_TOKEN.uid;
  const htrUid = hathorLibConstants.HATHOR_TOKEN_CONFIG.uid;

  // If the DEFAULT_TOKEN is not HTR, also download its balance and history:
  let loadCustom = [];
  if (customTokenUid !== htrUid) {
    yield put(tokenFetchBalanceRequested(customTokenUid));
    yield put(tokenFetchHistoryRequested(customTokenUid));

    loadCustom = [
      take(specificTypeAndPayload(
        types.TOKEN_FETCH_BALANCE_SUCCESS, {
          tokenId: customTokenUid,
        },
      )),
      take(specificTypeAndPayload(
        types.TOKEN_FETCH_HISTORY_SUCCESS, {
          tokenId: customTokenUid,
        },
      )),
    ];
  }

  // The `all` effect will wait for all effects in the list
  yield all([
    // The `take` effect will wait until one action that passes the predicate is captured
    take(specificTypeAndPayload(types.TOKEN_FETCH_BALANCE_SUCCESS, { tokenId: htrUid })),
    take(specificTypeAndPayload(types.TOKEN_FETCH_HISTORY_SUCCESS, { tokenId: htrUid })),
    ...loadCustom,
  ]);

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

  yield put(startWalletSuccess());
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

/**
 * Method that fetches the balance of a token
 * and pre process for the expected format
 *
 * wallet {HathorWallet | HathorWalletServiceWallet} wallet object
 * uid {String} Token uid to fetch balance
 */
export const fetchTokenBalance = async (wallet, uid) => {
  if (!wallet.isReady()) {
    // We can safely do nothing here since we will fetch all history and balance
    // as soon as the wallets gets ready
    return null;
  }
  const balance = await wallet.getBalance(uid);
  const tokenBalance = balance[0].balance;
  return { available: tokenBalance.unlocked, locked: tokenBalance.locked };
};

/**
 * After a new transaction arrives in the websocket we must
 * fetch the new balance for each token on it and use
 * this new data to update redux info
 *
 * wallet {HathorWallet | HathorWalletServiceWallet} wallet object
 * tx {Object} full transaction object from the websocket
 */
export const fetchNewTxTokenBalance = async (wallet, tx) => {
  const updatedBalanceMap = {};
  const balances = await wallet.getTxBalance(tx);
  // we now loop through all tokens present in the new tx to get the new balance
  for (const [tokenUid] of Object.entries(balances)) {
    /* eslint-disable no-await-in-loop */
    updatedBalanceMap[tokenUid] = await fetchTokenBalance(wallet, tokenUid);
  }
  return updatedBalanceMap;
};

export function* handleNewTx(action) {
  const tx = action.payload;
  const wallet = yield select((state) => state.wallet);

  if (!wallet.isReady()) {
    return;
  }

  const newTxTokenBalance = yield call(fetchNewTxTokenBalance, wallet, tx);

  for (const tokenId of Object.keys(newTxTokenBalance)) {
    yield put({
      type: 'TOKEN_FETCH_BALANCE_SUCCESS',
      payload: {
        tokenId,
        data: newTxTokenBalance[tokenId],
      },
    });
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

export function* onWalletConnStateUpdate(action) {
  const state = action.payload;
  const isOnline = state === Connection.CONNECTED;

  yield put(setIsOnline(isOnline));
}

export function* saga() {
  yield all([
    takeLatest('START_WALLET_REQUESTED', startWallet),
    takeLatest('WALLET_CONN_STATE_UPDATE', onWalletConnStateUpdate),
    takeEvery('WALLET_NEW_TX', handleNewTx),
  ]);
}
