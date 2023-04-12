/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Core } from '@walletconnect/core';
import { Web3Wallet } from '@walletconnect/web3wallet';

import {
  call,
  fork,
  take,
  all,
  put,
  cancel,
  cancelled,
  takeLatest,
  takeEvery,
  select,
  race,
} from 'redux-saga/effects';
import { eventChannel } from 'redux-saga';
import { get } from 'lodash';

import { WalletConnectModalTypes } from '../components/WalletConnect/WalletConnectModal';
import {
  WALLET_CONNECT_PROJECT_ID,
  WALLET_CONNECT_FEATURE_TOGGLE,
  NETWORK,
} from '../constants';
import {
  types,
  setWalletConnect,
  setWalletConnectModal,
  setWalletConnectSessions,
} from '../actions';
import { checkForFeatureFlag } from './helpers';

const AVAILABLE_METHODS = ['hathor_signMessage'];
const AVAILABLE_EVENTS = [];

/**
 * Those are the only ones we are currently using, extracted from
 * https://docs.walletconnect.com/2.0/specs/clients/sign/error-codes
 */
const ERROR_CODES = {
  UNAUTHORIZED_METHODS: 3001,
  USER_DISCONNECTED: 6000,
  USER_REJECTED: 5000,
  USER_REJECTED_METHOD: 5002,
};

function* isWalletConnectEnabled() {
  const walletConnectEnabled = yield call(checkForFeatureFlag, WALLET_CONNECT_FEATURE_TOGGLE);

  return walletConnectEnabled;
}

function* init() {
  try {
    const walletConnectEnabled = yield call(isWalletConnectEnabled);

    if (!walletConnectEnabled) {
      return;
    }

    const core = new Core({
      projectId: WALLET_CONNECT_PROJECT_ID,
    });

    const metadata = {
      name: 'Hathor',
      description: 'Hathor Mobile Wallet',
      url: 'https://hathor.network/',
    };

    const web3wallet = yield call(Web3Wallet.init, {
      core,
      metadata,
    });

    yield put(setWalletConnect({
      web3wallet,
      core,
    }));

    yield fork(setupListeners, web3wallet);

    yield call(refreshActiveSessions);

    // If the wallet is reset, we should cancel all listeners
    yield take(types.RESET_WALLET);

    yield cancel();
  } catch(error) {
    console.error('Error loading wallet connect', error);
    yield put(onExceptionCaptured(error));
  }
}

export function* refreshActiveSessions() {
  const { web3wallet } = yield select((state) => state.walletConnect);

  const activeSessions = yield call(() => web3wallet.getActiveSessions());
  yield put(setWalletConnectSessions(activeSessions));
}

export function* setupListeners(web3wallet) {
  const channel = eventChannel((emitter) => {
    const listener = (state) => emitter(state);

    web3wallet.on('session_request', (event) => {
      emitter({
        type: 'WC_SESSION_REQUEST',
        data: event,
      });
    });

    web3wallet.on('session_proposal', async (proposal) => {
      emitter({
        type: 'WC_SESSION_PROPOSAL',
        data: proposal,
      });
    });

    web3wallet.on('session_delete', async (session) => {
      emitter({
        type: 'WC_SESSION_DELETE',
        data: session,
      });
    });

    return () => {
      web3wallet.removeListener('session_request', listener);
      web3wallet.removeListener('session_proposal', listener);
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

export function* clearSessions() {
  const { web3wallet } = yield select((state) => state.walletConnect);

  const activeSessions = yield call(() => web3wallet.getActiveSessions());
  for (const key of Object.keys(activeSessions)) {
    yield call(() => web3wallet.disconnectSession({
      topic: activeSessions[key].topic, 
      reason: {
        code: USER_DISCONNECTED,
        message: '',
      },
    }));
  }

  yield call(refreshActiveSessions);
}

export function* onSessionRequest(action) {
  const { payload } = action;
  const { params } = payload;

  const { web3wallet } = yield select((state) => state.walletConnect);
  const activeSessions = yield call(() => web3wallet.getActiveSessions());
  const requestSession = activeSessions[payload.topic];
  if (!requestSession) {
    console.error('Could not identify the request session, ignoring request..');
    return;
  }

  const data = {
    icon: get(requestSession.peer, 'metadata.icons[0]', null),
    proposer: get(requestSession.peer, 'metadata.name', ''),
    url: get(requestSession.peer, 'metadata.url', ''),
    description: get(requestSession.peer, 'metadata.description', ''),
  };

  switch(params.request.method) {
    case 'hathor_signMessage':
      yield put({
        type: 'SIGN_MESSAGE_REQUEST',
        payload: {
          ...data,
          requestId: payload.id,
          topic: payload.topic,
          message: get(params, 'request.params.message'),
        }
      });
    break;
    default:
      yield call(() => web3wallet.respondSessionRequest({
        topic: payload.topic,
        response: {
          id: payload.id,
          jsonrpc: '2.0',
          error: {
            code: USER_REJECTED_METHOD,
            message: 'Rejected by the user',
          },
        },
      }));
    break;
  }
}

export function* onSignMessageRequest(action) {
  const data = action.payload;
  const { web3wallet } = yield select((state) => state.walletConnect);

  const onAcceptAction = { type: 'WALLET_CONNECT_ACCEPT' };
  const onRejectAction = { type: 'WALLET_CONNECT_REJECT' };

  yield put(setWalletConnectModal({
    show: true,
    type: WalletConnectModalTypes.SIGN_MESSAGE,
    data,
    onAcceptAction,
    onRejectAction,
  }));

  const { accept } = yield race({
    accept: take(onAcceptAction.type),
    reject: take(onRejectAction.type),
  });

  try {
    if (!accept) {
      yield call(() => web3wallet.respondSessionRequest({
        topic: payload.topic,
        response: {
          id: payload.id,
          jsonrpc: '2.0',
          error: {
            code: USER_REJECTED,
            message: 'Rejected by the user',
          },
        },
      }));
      return;
    }

    const wallet = yield select((state) => state.wallet);

    if (!wallet.isReady()) {
      console.error('Got a session request but wallet is not ready, ignoring..');
      return;
    }

    const signedMessage = yield call(() => wallet.signArbitraryMessage(data.message));

    const response = {
      id: data.requestId,
      jsonrpc: '2.0',
      result: signedMessage,
    };

    yield call(() => web3wallet.respondSessionRequest({
      topic: data.topic,
      response,
    }));
  } catch(error) {
    console.log('Captured error on signMessage: ', error);
    yield put(onExceptionCaptured(error));
  }
}

export function* onWalletReset() {
  const { web3wallet } = yield select((state) => state.walletConnect);
  if (!web3wallet) {
    // Do nothing, wallet connect might not have been initialized yet
    return;
  }

  yield call(clearSessions);
}

export function* onSessionProposal(action) {
  const { id, params } = action.payload;
  const { web3wallet } = yield select((state) => state.walletConnect);

  const wallet = yield select((state) => state.wallet);
  const addresses = wallet.newAddresses;
  const firstAddress = addresses[0].address;

  const data = {
    icon: get(params, 'proposer.metadata.icons[0]', null),
    proposer: get(params, 'proposer.metadata.name', ''),
    url: get(params, 'proposer.metadata.url', ''),
    description: get(params, 'proposer.metadata.description', ''),
    requiredNamespaces: get(params, 'requiredNamespaces', []),
  };

  const onAcceptAction = { type: 'WALLET_CONNECT_ACCEPT' };
  const onRejectAction = { type: 'WALLET_CONNECT_REJECT' };

  yield put(setWalletConnectModal({
    show: true,
    type: WalletConnectModalTypes.CONNECT,
    data,
    onAcceptAction,
    onRejectAction,
  }));

  const { accept } = yield race({
    accept: take(onAcceptAction.type),
    reject: take(onRejectAction.type),
  });

  if (!accept) {
    yield call(() => web3wallet.rejectSession({
      id: params.id,
      reason: {
        code: USER_REJECTED,
        message: 'User rejected the session',
      },
    }));
  }

  try {
    yield call(() => web3wallet.approveSession({
      id,
      relayProtocol: params.relays[0].protocol,
      namespaces: {
        hathor: {
          accounts: [`hathor:${NETWORK}:${firstAddress}`],
          chains: [`hathor:${NETWORK}`],
          events: AVAILABLE_EVENTS,
          methods: AVAILABLE_METHODS,
        },
      },
    }));

    yield call(refreshActiveSessions);
  } catch(error) {
    console.error('Error on sessionProposal: ', error);
    yield put(onExceptionCaptured(error));
  }
}

export function* onQrCodeRead(action) {
  const { web3wallet, core } = yield select((state) => state.walletConnect);

  if (!web3wallet) {
    throw new Error('Wallet connect instance is new and QRCode was read');
  }

  const { payload } = action;

  try {
    yield call(() => core.pairing.pair({ uri: payload }));
  } catch(error) {
    console.error('Error pairing with QrCode: ', error); 
    yield put(onExceptionCaptured(error));
  }
}

export function* featureToggleUpdateListener() {
  while (true) {
    const oldWalletConnectEnabled = yield call(isWalletConnectEnabled);
    yield take('FEATURE_TOGGLE_UPDATED');
    const newWalletConnectEnabled = yield call(isWalletConnectEnabled);

    if (oldWalletConnectEnabled && !newWalletConnectEnabled) {
      yield put({ type: 'WC_SHUTDOWN' });
    }
  }
}

export function* onCancelSession(action) {
  const { web3wallet } = yield select((state) => state.walletConnect);

  const activeSessions = yield call(() => web3wallet.getActiveSessions());

  if (!activeSessions[action.payload]) {
    return;
  }

  yield call(() => web3wallet.disconnectSession({
    topic: activeSessions[action.payload].topic, 
    reason: {
      code: USER_DISCONNECTED,
      message: 'User cancelled the session',
    },
  }));

  yield call(refreshActiveSessions);
}

/**
 * This event can be triggered by either the wallet or dapp, indicating the
 * termination of a session. Emitted only after the session has been
 * successfully deleted.
 */
export function* onSessionDelete(action) {
  yield call(onCancelSession, action);
}

export function* saga() {
  yield all([
    takeLatest(types.START_WALLET_SUCCESS, init),
    takeEvery('WC_SESSION_REQUEST', onSessionRequest),
    takeEvery('WC_SESSION_PROPOSAL', onSessionProposal),
    takeEvery('WC_SESSION_DELETE', onSessionDelete),
    takeEvery('WC_CANCEL_SESSION', onCancelSession),
    takeEvery(types.RESET_WALLET, onWalletReset),
    takeLatest('SIGN_MESSAGE_REQUEST', onSignMessageRequest),
    takeLatest(types.WC_QRCODE_READ, onQrCodeRead),
  ]);
}
