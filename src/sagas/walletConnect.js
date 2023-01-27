/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Core } from '@walletconnect/core';
import { Web3Wallet, getSdkError } from '@walletconnect/web3wallet';
import AuthClient from "@walletconnect/auth-client";

import {
  call,
  fork,
  take,
  all,
  put,
  cancelled,
  takeLatest,
  select,
} from 'redux-saga/effects';
import { eventChannel } from 'redux-saga';

import { WALLET_CONNECT_PROJECT_ID } from '../constants';
import { types, setWalletConnect } from '../actions';

function* init() {
  const core = new Core({
    projectId: WALLET_CONNECT_PROJECT_ID,
    relayUrl: 'ws://192.168.15.8:8080/',
  });

  const walletConnect = yield call(AuthClient.init, {
    core,
    projectId: WALLET_CONNECT_PROJECT_ID,
    metadata: {
      name: 'Hathor PoC',
      description: 'Proof-of-concept using hathor wallet and WalletConnect',
      url: 'www.walletconnect.com',
      icons: ['https://my-auth-wallet.com/icons/logo.png'],
    },
  });

  console.log('Wallet connect: ', walletConnect);

  yield put(setWalletConnect(walletConnect));
  yield fork(setupListeners, walletConnect);
}

export function* setupListeners(walletConnect) {
  const channel = eventChannel((emitter) => {
    const listener = (state) => emitter(state);

    walletConnect.on('session_approval', (proposal) => {
      emitter({
        type: 'WC_SESSION_APPROVAL',
        data: proposal,
      });
    });

    walletConnect.on('session_request', (event) => {
      emitter({
        type: 'WC_SESSION_REQUEST',
        data: event,
      });
    });

    return () => {
      walletConnect.removeListener('session_approval', listener);
      walletConnect.removeListener('session_request', listener);
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

export function onSessionApproval(action) {
  const { payload } = action;

  console.log('Captured session approval proposal', payload);
}

export function onSessionRequest(action) {
  const { payload } = action;

  console.log('Captured session request proposal', payload);
}

export function* onWalletReset() {
  const walletConnect = yield select((state) => state.walletConnect);
  if (!walletConnect) {
    // Do nothing, wallet connect might not have been initialized yet
  }

  /* yield call(walletConnect.disconnectSession.bind(walletConnect), {
    topic,
    reason: getSdkError('USER_DISCONNECTED'),
  }); */
}

export function* onQrCodeRead(action) {
  const walletConnect = yield select((state) => state.walletConnect);

  console.log(walletConnect);

  if (!walletConnect) {
    throw new Error('Wallet connect instance is new and QRCode was read');
  }

  const { payload } = action;

  console.log('Read qr code was ', payload);

  try {
    console.log('Pair method:', walletConnect.core.pairing.pair);
    const wat = yield call(walletConnect.core.pairing.pair.bind(walletConnect), { uri: payload });
    console.log('Received: ', wat);
  } catch(e) {
    console.log('Captured: ', e)
  }
}

export function* saga() {
  yield all([
    takeLatest(types.START_WALLET_SUCCESS, init),
    takeLatest('WS_SESSION_APPROVAL', onSessionApproval),
    takeLatest('WS_SESSION_REQUEST', onSessionRequest),
    takeLatest(types.RESET_WALLET, onWalletReset),
    takeLatest(types.WC_QRCODE_READ, onQrCodeRead),
  ]);
}
