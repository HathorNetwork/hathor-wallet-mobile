/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';

// reown.js imports these native/ESM-only packages at module load; these tests never touch them.
jest.mock('@walletconnect/react-native-compat', () => ({}));
jest.mock('@walletconnect/core', () => ({ Core: jest.fn() }));
jest.mock('@reown/walletkit', () => ({ WalletKit: { init: jest.fn() } }));
// The send transaction prompt needs navigation; a placeholder renders in its place.
jest.mock('../../../src/components/Reown/SendTransactionModal', () => {
  // eslint-disable-next-line global-require
  const { Text } = require('react-native');
  return () => <Text>send-transaction-prompt</Text>;
});

/* eslint-disable import/first */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import createSagaMiddleware from 'redux-saga';
import { takeLatest } from 'redux-saga/effects';
import { Network } from '@hathor/wallet-lib';
import { reducer } from '../../../src/reducers/reducer';
import {
  setReown,
  setReownModal,
  setWallet,
  showSendTransactionModal,
  types,
} from '../../../src/actions';
import { processRequest, onSendTransactionRequest } from '../../../src/sagas/reown';
import ReownModal, { ReownModalTypes } from '../../../src/components/Reown/ReownModal';
import { PortalProvider } from '../../../src/components/Portal';
import { shieldedAddressNotSupportedText } from '../../../src/utils';
/* eslint-enable import/first */

// The store starts on the mainnet network settings.
const MAINNET_P2PKH = 'HHzVcXf5FRK5gM26hFgZ6bCwtFFYovJVjE';
const MAINNET_SHIELDED = 'Ce61z7k3hbx6xtx7ZN86iu5L16XSCpPoFp3V2pCJzWfXpCD9cEemGQQ3WuJysuaF8qbr6yPUZB2ui6t2eEbN2rFxp7mn7PtMW';
const TOPIC = 'topic-1';

const renderedText = (renderer) => JSON.stringify(renderer.toJSON());

// BackdropModal shows its content 100 ms after it opens.
const waitForModalContent = () => act(async () => {
  await new Promise((resolve) => { setTimeout(resolve, 150); });
});

async function setup() {
  const walletKit = {
    getPendingSessionProposals: jest.fn(() => ({})),
    getPendingSessionRequests: jest.fn(() => [{ id: 1 }, { id: 2 }]),
    getActiveSessions: jest.fn(() => ({
      [TOPIC]: { peer: { metadata: { name: 'dapp' } }, namespaces: {} },
    })),
    respondSessionRequest: jest.fn(async () => {}),
  };
  const actionTypes = [];
  const recordActions = () => (next) => (action) => {
    if (action?.type) {
      actionTypes.push(action.type);
    }
    return next(action);
  };
  const sagaMiddleware = createSagaMiddleware();
  const store = createStore(reducer, applyMiddleware(thunk, recordActions, sagaMiddleware));
  store.dispatch(setWallet({
    isReady: () => true,
    getNetworkObject: () => new Network('mainnet'),
  }));
  store.dispatch(setReown({ walletKit, core: {} }));
  sagaMiddleware.run(function* watchSendTransactionRequests() {
    yield takeLatest(types.SHOW_SEND_TRANSACTION_REQUEST_MODAL, onSendTransactionRequest);
  });

  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><PortalProvider><ReownModal /></PortalProvider></Provider>,
    );
  });
  return { store, sagaMiddleware, renderer, walletKit, actionTypes };
}

// The rpc handler prompts for the next queued request, and the prompt replaces the Reown modal
// on screen. The user does not touch anything.
async function promptNextRequest(store, renderer) {
  const accept = jest.fn();
  const deny = jest.fn();
  await act(async () => {
    store.dispatch(showSendTransactionModal(accept, deny, {}, { name: 'dapp' }));
  });
  expect(renderedText(renderer)).toContain('send-transaction-prompt');
  return { accept, deny };
}

const ERROR_SOURCES = [
  ['a shielded address', {
    method: 'htr_sendTransaction',
    params: {
      network: 'mainnet',
      outputs: [{ address: MAINNET_P2PKH, value: '1' }, { address: MAINNET_SHIELDED, value: '1' }],
    },
  }],
  ['a method the rpc handler does not know', { method: 'htr_unknownMethod', params: {} }],
];

describe('RequestErrorModal', () => {
  test('the next request prompt waits for the user when nothing was on screen before', async () => {
    const { store, renderer } = await setup();
    const { accept, deny } = await promptNextRequest(store, renderer);
    expect(accept).not.toHaveBeenCalled();
    expect(deny).not.toHaveBeenCalled();
  });

  test.each(ERROR_SOURCES)('the next request prompt waits for the user after an error for %s', async (_source, request) => {
    const { store, sagaMiddleware, renderer, walletKit } = await setup();

    // Request 1 fails: processRequest answers the dApp and shows the error modal.
    await act(async () => {
      await sagaMiddleware.run(processRequest, {
        payload: { id: 1, topic: TOPIC, params: { request } },
      }).toPromise();
    });
    expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(walletKit.respondSessionRequest.mock.calls[0][0].response.error).toBeDefined();
    await waitForModalContent();
    expect(store.getState().reown.modal.type).toBe(ReownModalTypes.REQUEST_ERROR);

    // Request 2's prompt replaces the error modal.
    const { accept, deny } = await promptNextRequest(store, renderer);
    expect(accept).not.toHaveBeenCalled();
    expect(deny).not.toHaveBeenCalled();
  });

  test('closes on Dismiss without rejecting anything', async () => {
    const { store, renderer, actionTypes } = await setup();
    await act(async () => {
      store.dispatch(setReownModal({
        show: true,
        type: ReownModalTypes.REQUEST_ERROR,
        data: { errorMessage: shieldedAddressNotSupportedText },
      }));
    });
    await waitForModalContent();
    expect(renderedText(renderer)).toContain(shieldedAddressNotSupportedText);

    const [dismissButton] = renderer.root.findAll((node) => node.props.title === 'Dismiss');
    await act(async () => {
      dismissButton.props.onPress();
    });

    expect(store.getState().reown.modal.show).toBe(false);
    expect(actionTypes).not.toContain(types.REOWN_REJECT);
  });
});
