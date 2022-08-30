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
  setUseWalletService,
  setUniqueDeviceId,
  setWallet,
  setIsOnline,
} from '../actions';
import {
  specificTypeAndPayload,
} from './helpers';
import NavigationService from '../NavigationService';

function* setupWalletServiceListeners(action) {

}

function* setupOldFacadeListeners(action) {
}

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
    success: take('WALLET_STATE_READY'),
    error: take('WALLET_STATE_ERROR'),
  });

  if (!error) {
    // Wallet loaded succesfully here, we should load the hathor token balance and history
    yield put({ type: 'TOKEN_FETCH_BALANCE_REQUESTED', payload: hathorLibConstants.HATHOR_TOKEN_CONFIG.uid });
    yield put({ type: 'TOKEN_FETCH_HISTORY_REQUESTED', tokenId: hathorLibConstants.HATHOR_TOKEN_CONFIG.uid });

    const customTokenUid = DEFAULT_TOKEN.uid;
    const htrUid = hathorLibConstants.HATHOR_TOKEN_CONFIG.uid;

    // If the DEFAULT_TOKEN is not HTR, also download its balance and history:
    const loadCustom = [];
    if (customTokenUid !== htrUid) {
      // TODO: Also dispatch load history actions
      yield put({ type: 'TOKEN_FETCH_BALANCE_REQUESTED', payload: customTokenUid });

      loadCustom.push(take(specificTypeAndPayload('TOKEN_FETCH_BALANCE_SUCCESS', customTokenUid)));
    }

    // The `all` effect will wait for all effects in the list
    yield all([
      // The `take` effect will wait until one action that passes the predicate is captured
      take(specificTypeAndPayload('TOKEN_FETCH_BALANCE_SUCCESS', { tokenId: htrUid })),
      take(specificTypeAndPayload('TOKEN_FETCH_HISTORY_SUCCESS', { tokenId: htrUid })),
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
      yield put({
        type: 'TOKEN_FETCH_BALANCE_REQUESTED',
        payload: token,
      });
    }
  } else {
    yield put({
      type: 'START_WALLET_FAILURE',
    });

    return;
  }

  yield put({
    type: 'START_WALLET_SUCCESS',
  });
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
      yield put({ type: 'WALLET_STATE_ERROR' });
      break;
    } else {
      if (wallet.isReady()) {
        yield put({ type: 'WALLET_STATE_READY' });
        break;
      }

      continue;
    }
  }

  // When we close the channel, it will remove the event listener
  channel.close();
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
  ]);
}
