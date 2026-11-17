/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

// reown.js imports these native/ESM-only packages at module load; this test never touches them.
jest.mock('@walletconnect/react-native-compat', () => ({}));
jest.mock('@walletconnect/core', () => ({ Core: jest.fn() }));
jest.mock('@reown/walletkit', () => ({ WalletKit: { init: jest.fn() } }));
jest.mock('@hathor/hathor-rpc-handler', () => ({
  ...jest.requireActual('@hathor/hathor-rpc-handler'),
  handleRpcRequest: jest.fn(),
}));

/* eslint-disable import/first */
import { runSaga } from 'redux-saga';
import { Network } from '@hathor/wallet-lib';
import { handleRpcRequest, PrepareSendTransactionError } from '@hathor/hathor-rpc-handler';
import { processRequest } from '../../src/sagas/reown';
import { types } from '../../src/actions';
/* eslint-enable import/first */

// A testnet P2PKH address built with wallet-lib's address encoders from a fixed key.
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const TOPIC = 'topic-1';
const REQUEST_ID = 42;
const INVALID_PAYLOAD = 5003;

// A dApp's send to a public address, with its own legacy change address.
const SEND_REQUEST = {
  method: 'htr_sendTransaction',
  params: {
    network: 'testnet',
    outputs: [{ address: P2PKH, value: '10' }],
    changeAddress: P2PKH,
  },
};

// wallet-lib's messages, as the shielded selection rules write them.
const TRANSPARENT_HINT = '; pass changeShieldedMode: OutputKind.TRANSPARENT to keep the change transparent.';
const LEGACY_CHANGE_ADDRESS = "The change must be shielded (all of its token's outputs are shielded, or the transaction spends a shielded UTXO), and a legacy change address cannot receive it. Use a new-format change address, or changeShieldedMode: OutputKind.TRANSPARENT to keep the change transparent.";
const FORCED_CHANGE = `The change must be shielded (so the value of the shielded UTXO spent exactly cannot be computed by subtraction), but it is too small to fund its shielded-output fee and no additional HTR is available to cover the difference${TRANSPARENT_HINT}`;

const walletKit = {
  getPendingSessionRequests: jest.fn(() => [{ id: REQUEST_ID }]),
  getActiveSessions: jest.fn(() => ({
    [TOPIC]: { peer: { metadata: { name: 'dapp' } }, namespaces: {} },
  })),
  respondSessionRequest: jest.fn(async () => {}),
};

// Stub only the client/network helpers, by name; everything else runs for real.
const stubs = {
  getReownClient: () => ({ walletKit }),
  checkForPendingRequests: () => undefined,
};
const stubMiddleware = (next) => (effect) => {
  const name = effect?.type === 'CALL' ? effect.payload.fn?.name : undefined;
  if (name && stubs[name]) {
    return next(stubs[name]());
  }
  return next(effect);
};

async function runProcessRequest(request) {
  const dispatched = [];
  // Mirrors redux-thunk: processRequest grabs `dispatch` by putting a function.
  const dispatch = (action) => {
    if (typeof action === 'function') {
      return action(dispatch);
    }
    dispatched.push(action);
    return action;
  };
  const wallet = { getNetworkObject: () => new Network('testnet') };
  const task = runSaga(
    {
      dispatch,
      getState: () => ({ wallet, networkSettings: { network: 'testnet' } }),
      effectMiddlewares: [stubMiddleware],
    },
    processRequest,
    { payload: { id: REQUEST_ID, topic: TOPIC, params: { request } } },
  );
  await task.toPromise();
  return dispatched;
}

const errorModals = (dispatched) => dispatched.filter((action) => (
  action.type === types.SET_REOWN_MODAL && action.payload?.type === 'RequestError'
));

const expectFailedValidationAnswer = () => {
  expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(1);
  expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
    topic: TOPIC,
    response: {
      id: REQUEST_ID,
      jsonrpc: '2.0',
      error: { code: INVALID_PAYLOAD, message: 'Transaction failed validation' },
    },
  });
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('processRequest with a send whose change must stay private', () => {
  test('explains a change the dApp sends to a legacy address', async () => {
    handleRpcRequest.mockRejectedValue(new PrepareSendTransactionError(LEGACY_CHANGE_ADDRESS));

    const dispatched = await runProcessRequest(SEND_REQUEST);

    expect(errorModals(dispatched)).toEqual([{
      type: types.SET_REOWN_MODAL,
      payload: {
        show: true,
        type: 'RequestError',
        data: {
          errorMessage: "This transaction spends private funds, so its change must stay private, but the dApp asked to send the change to an address that can't receive private funds.",
        },
      },
    }]);
    // "See why" shows wallet-lib's message.
    expect(dispatched).toContainEqual({
      type: types.REOWN_SET_ERROR,
      payload: expect.objectContaining({ message: LEGACY_CHANGE_ADDRESS }),
    });
    expectFailedValidationAnswer();
  });

  test('explains a private change that no HTR can fund', async () => {
    handleRpcRequest.mockRejectedValue(new PrepareSendTransactionError(FORCED_CHANGE));

    const dispatched = await runProcessRequest(SEND_REQUEST);

    expect(errorModals(dispatched).map((action) => action.payload.data.errorMessage)).toEqual([
      'To keep the value of the private funds it spends hidden, this transaction needs a private change, and there is not enough HTR to pay its privacy fee.',
    ]);
    expectFailedValidationAnswer();
  });

  test('explains a private change the wallet can not receive', async () => {
    handleRpcRequest.mockRejectedValue(new PrepareSendTransactionError(
      `A shielded change is required, but the wallet has no shielded address to receive it${TRANSPARENT_HINT}`,
    ));

    const dispatched = await runProcessRequest(SEND_REQUEST);

    expect(errorModals(dispatched).map((action) => action.payload.data.errorMessage)).toEqual([
      'This wallet cannot receive the private change this transaction needs.',
    ]);
    expectFailedValidationAnswer();
  });

  test('keeps other prepare errors silent', async () => {
    handleRpcRequest.mockRejectedValue(new PrepareSendTransactionError('Change address is not from the wallet'));

    const dispatched = await runProcessRequest(SEND_REQUEST);

    expect(errorModals(dispatched)).toEqual([]);
    expect(dispatched.map((action) => action.type)).not.toContain(types.REOWN_SET_ERROR);
    expectFailedValidationAnswer();
  });
});
