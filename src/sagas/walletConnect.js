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
  cancelled,
  takeLatest,
  select,
  race,
} from 'redux-saga/effects';
import { eventChannel } from 'redux-saga';
import { WalletConnectModalTypes } from '../components/WalletConnect/WalletConnectModal';

import { WALLET_CONNECT_PROJECT_ID } from '../constants';
import {
  types,
  setWalletConnect,
  setWalletConnectModal,
  setWalletConnectSessions,
} from '../actions';

function* init() {
  const core = new Core({
    projectId: WALLET_CONNECT_PROJECT_ID,
  });

  const metadata = {
    name: 'Hathor WalletConnect PoC',
    description: 'Proof-of-concept using WalletConnect to connect to a Hathor dApp',
    url: 'https://hathor.network/',
    icons: ['hathor_logo.png'],
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

  yield call(clearSessions);
}

export function* refreshActiveSessions() {
  const { web3wallet } = yield select((state) => state.walletConnect);

  const activeSessions = yield call(() => web3wallet.getActiveSessions());
  yield put(setWalletConnectSessions(activeSessions));
}

export function* setupListeners(web3wallet) {
  const channel = eventChannel((emitter) => {
    const listener = (state) => emitter(state);
    console.log('Setting up listeners!', web3wallet);

    // sign
    web3wallet.on('session_approval', (proposal) => {
      emitter({
        type: 'WC_SESSION_APPROVAL',
        data: proposal,
      });
    });

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

    return () => {
      web3wallet.removeListener('session_approval', listener);
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
    console.log('active session', activeSessions[key]);
    yield call(() => web3wallet.disconnectSession({
      topic: activeSessions[key].topic, 
      reason: {
        code: -1,
        message: 'User rejected the session',
      },
    }));
  }

  // yield call(refreshActiveSessions);
}

export function* onSessionProposal(action) {
  console.log('On Session proposal', action.payload);
  const { id, params } = action.payload;
  const { web3wallet } = yield select((state) => state.walletConnect);

  const wallet = yield select((state) => state.wallet);
  const addresses = wallet.newAddresses;

  console.log(action.payload);

  const onAcceptAction = { type: 'WALLET_CONNECT_ACCEPT' };
  const onRejectAction = { type: 'WALLET_CONNECT_REJECT' };

  yield put(setWalletConnectModal({
    show: true,
    type: WalletConnectModalTypes.CONNECT,
    data: {
      proposer: params.proposer.metadata.name,
      description: params.proposer.metadata.description,
      requiredNamespaces: params.requiredNamespaces,
    },
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
        code: -1,
        message: 'User rejected the session',
      },
    }));
  }

  try {
    const sessionApproved = yield call(() => web3wallet.approveSession({
      id,
      relayProtocol: params.relays[0].protocol,
      namespaces: {
        hathor: {
          accounts: [`hathor:mainnet:${addresses[0].address}`],
          chains: ['hathor:mainnet'],
          events: [],
          methods: ['hathor_signMessage'],
        },
      },
    }));

    yield call(refreshActiveSessions);
    console.log('sessionapproved', sessionApproved)
  } catch(e) {
    console.log('ERROR: ', e);
  }
}

export function onSessionApproval(action) {
  const { payload } = action;

  console.log('Captured session approval proposal', payload);
}

export function* onSessionRequest(action) {
  const { payload } = action;
  const { params } = payload;

  console.log('onSessionRequest', action);

  const chainId = params.chainId;
  // const [chain, network] = chainId.split(':');

  switch(params.request.method) {
    case 'hathor_signMessage':
      yield put({
        type: 'SIGN_MESSAGE_REQUEST',
        payload: action.payload,
      });
    break;
  }
}

export function* onWalletReset() {
  const { web3wallet } = yield select((state) => state.walletConnect);
  if (!web3wallet) {
    // Do nothing, wallet connect might not have been initialized yet
  }

  /* yield call(walletConnect.disconnectSession.bind(walletConnect), {
    topic,
    reason: getSdkError('USER_DISCONNECTED'),
  }); */
}

export function* onSignMessageRequest(action) {
  const { payload } = action;

  const { web3wallet } = yield select((state) => state.walletConnect);

  const onAcceptAction = { type: 'WALLET_CONNECT_ACCEPT' };
  const onRejectAction = { type: 'WALLET_CONNECT_REJECT' };

  yield put(setWalletConnectModal({
    show: true,
    text: `
WalletConnect wants to sign the following message:

      ${payload.params.request.params.message}

With the following address private key:

      ${payload.params.request.params.address}
    `,
    onAcceptAction,
    onRejectAction,
  }));

  const { accept } = yield race({
    accept: take(onAcceptAction.type),
    reject: take(onRejectAction.type),
  });

  if (!accept) {
    yield call(() => web3wallet.respondSessionRequest({
      topic: payload.topic,
      response: {
        id: payload.id,
        jsonrpc: '2.0',
        error: {
          code: -3200,
          message: 'Rejected by the user',
        },
      },
    }));
    return;
  }

  const response = {
    id: payload.id,
    jsonrpc: '2.0',
    result: 'signed-data-in-base64',
  };

  yield call(() => web3wallet.respondSessionRequest({
    topic: payload.topic,
    response,
  }));
}

export function* onQrCodeRead(action) {
  const { web3wallet, core } = yield select((state) => state.walletConnect);

  if (!web3wallet) {
    throw new Error('Wallet connect instance is new and QRCode was read');
  }

  const { payload } = action;

  try {
    yield call(() => core.pairing.pair({ uri: payload }));
    console.log('Pairing..');
  } catch(e) {
    console.error('Error pairing with QrCode: ', e); 
  }
}

export function* saga() {
  yield all([
    takeLatest(types.START_WALLET_SUCCESS, init),
    takeLatest('WS_SESSION_APPROVAL', onSessionApproval),
    takeLatest('WC_SESSION_REQUEST', onSessionRequest),
    takeLatest('WC_SESSION_PROPOSAL', onSessionProposal),
    takeLatest('SIGN_MESSAGE_REQUEST', onSignMessageRequest),
    takeLatest(types.RESET_WALLET, onWalletReset),
    takeLatest(types.WC_QRCODE_READ, onQrCodeRead),
  ]);
}
