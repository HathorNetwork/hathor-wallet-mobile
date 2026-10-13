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
import { handleRpcRequest } from '@hathor/hathor-rpc-handler';
import { processRequest } from '../../src/sagas/reown';
import { types } from '../../src/actions';
import { shieldedAddressNotSupportedText } from '../../src/utils';
/* eslint-enable import/first */

// Testnet addresses built with wallet-lib's address encoders from fixed keys.
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const SHIELDED = 'K3KokZRo7DyNRRiyijpsVix2VADrd4HeA8vWLR5itAj81BVC4Vv7xoXbrYyKYwsLMWhefXqXKgJvC6HcVkDuJ7AJ7qUMS7fVc';

const NC_ID = '000063f99b133c7630bc9d0117919f5b8726155412ad063dbbd618bdc7f85d7a';
const TOPIC = 'topic-1';
const REQUEST_ID = 42;
const INVALID_PAYLOAD = 5003;

// How many levels deep processRequest reads nano contract arguments: `args` is one level, and
// each list, tuple, dict or SignedData value in it is one more.
const DEPTH_LIMIT = 32;

// `value` wrapped `levels` times by `wrap`.
function nest(value, levels, wrap) {
  let nested = value;
  for (let i = 0; i < levels; i += 1) {
    nested = wrap(nested);
  }
  return nested;
}
// inLists(x, 2) is [[x]].
const inLists = (value, levels) => nest(value, levels, (inner) => [inner]);
// inDicts(x, 2) is { key: { key: x } }.
const inDicts = (value, levels) => nest(value, levels, (inner) => ({ key: inner }));

const sendNanoContractTx = (args) => ({
  method: 'htr_sendNanoContractTx',
  params: { network: 'testnet', method: 'run', nc_id: NC_ID, actions: [], args },
});
const createNanoContractCreateTokenTx = (args) => ({
  method: 'htr_createNanoContractCreateTokenTx',
  params: {
    method: 'initialize',
    address: P2PKH,
    data: { nc_id: NC_ID, actions: [], args },
    createTokenOptions: {
      name: 'Token',
      symbol: 'TKN',
      amount: '100',
      version: 'deposit',
      contractPaysTokenDeposit: false,
    },
  },
});

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

const testnetWallet = { getNetworkObject: () => new Network('testnet') };

async function runProcessRequest(request, wallet = testnetWallet) {
  const dispatched = [];
  // Mirrors redux-thunk: processRequest grabs `dispatch` by putting a function.
  const dispatch = (action) => {
    if (typeof action === 'function') {
      return action(dispatch);
    }
    dispatched.push(action);
    return action;
  };
  const task = runSaga(
    { dispatch, getState: () => ({ wallet }), effectMiddlewares: [stubMiddleware] },
    processRequest,
    { payload: { id: REQUEST_ID, topic: TOPIC, params: { request } } },
  );
  await task.toPromise();
  return dispatched;
}

const invalidPayloadAnswer = {
  topic: TOPIC,
  response: {
    id: REQUEST_ID,
    jsonrpc: '2.0',
    error: { code: INVALID_PAYLOAD, message: expect.any(String) },
  },
};
// The request error modal with its generic message.
const requestErrorModal = {
  type: types.SET_REOWN_MODAL,
  payload: { show: true, type: 'RequestError' },
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('processRequest with nested nano contract arguments', () => {
  // The dApp decides how deep the arguments nest. WalletConnect holds back its later requests,
  // and those of every other dApp, until this one is answered.
  test.each([
    ['arguments nested 3,000 lists deep', sendNanoContractTx(inLists(P2PKH, 3000))],
    ['arguments nested 3,000 dicts deep', sendNanoContractTx([inDicts(P2PKH, 2999)])],
    [
      'create token arguments nested 3,000 lists deep',
      createNanoContractCreateTokenTx(inLists(P2PKH, 3000)),
    ],
  ])('answers %s with INVALID_PAYLOAD', async (_args, request) => {
    const dispatched = await runProcessRequest(request);

    expect(handleRpcRequest).not.toHaveBeenCalled();
    expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith(invalidPayloadAnswer);
    expect(dispatched).toContainEqual(requestErrorModal);
  });

  test('answers arguments one level deeper than the limit with INVALID_PAYLOAD', async () => {
    const dispatched = await runProcessRequest(sendNanoContractTx(inLists(P2PKH, DEPTH_LIMIT + 1)));

    expect(handleRpcRequest).not.toHaveBeenCalled();
    expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith(invalidPayloadAnswer);
    expect(dispatched).toContainEqual(requestErrorModal);
  });

  test.each([
    ['nested as deep as the limit', inLists(P2PKH, DEPTH_LIMIT)],
    // A string, a tuple, a dict of lists of tuples and a SignedData value.
    ['of the nano contract argument types', [
      'memo',
      [P2PKH, 5],
      { [P2PKH]: [[P2PKH, 10]] },
      { type: 'Address', signature: 'abcd', value: P2PKH },
    ]],
  ])('passes arguments %s to the rpc handler', async (_args, args) => {
    handleRpcRequest.mockResolvedValue({ type: 'test-response' });

    await runProcessRequest(sendNanoContractTx(args));

    expect(handleRpcRequest).toHaveBeenCalledTimes(1);
    expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith(expect.objectContaining({
      response: expect.objectContaining({ result: { type: 'test-response' } }),
    }));
  });

  test('rejects a shielded address nested as deep as the limit', async () => {
    const dispatched = await runProcessRequest(sendNanoContractTx(inLists(SHIELDED, DEPTH_LIMIT)));

    expect(handleRpcRequest).not.toHaveBeenCalled();
    expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith(invalidPayloadAnswer);
    expect(dispatched).toContainEqual({
      type: types.SET_REOWN_MODAL,
      payload: {
        show: true,
        type: 'RequestError',
        data: { errorMessage: shieldedAddressNotSupportedText },
      },
    });
  });
});

describe('processRequest when the address check fails', () => {
  test('answers the request with INVALID_PAYLOAD', async () => {
    const wallet = {
      getNetworkObject: () => {
        throw new Error('The wallet has no network.');
      },
    };
    const request = {
      method: 'htr_sendTransaction',
      params: { network: 'testnet', outputs: [{ address: P2PKH, value: '10' }] },
    };

    const dispatched = await runProcessRequest(request, wallet);

    expect(handleRpcRequest).not.toHaveBeenCalled();
    expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(1);
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith(invalidPayloadAnswer);
    expect(dispatched).toContainEqual(requestErrorModal);
    // The error details behind the modal's "See error details".
    expect(dispatched).toContainEqual({
      type: types.REOWN_SET_ERROR,
      payload: expect.objectContaining({ message: 'The wallet has no network.' }),
    });
  });
});
