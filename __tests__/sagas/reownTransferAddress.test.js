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
import { MULTICHAIN_FEATURE_TOGGLE } from '../../src/constants';
import { KNOWN_TRANSFER_ADDRESSES } from '../../src/multichain/chains';
/* eslint-enable import/first */

const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const [TRANSFER_ADDRESS] = KNOWN_TRANSFER_ADDRESSES;
const TOPIC = 'topic-1';
const REQUEST_ID = 42;
const INVALID_PAYLOAD = 5003;

const sendTo = (address) => ({
  method: 'htr_sendTransaction',
  params: { network: 'testnet', outputs: [{ address: P2PKH, value: '10' }, { address, value: '5' }] },
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

async function runProcessRequest(request, {
  walletNetwork = 'testnet',
  settingsNetwork = 'testnet',
  state = {},
} = {}) {
  const dispatched = [];
  // Mirrors redux-thunk: processRequest grabs `dispatch` by putting a function.
  const dispatch = (action) => {
    if (typeof action === 'function') {
      return action(dispatch);
    }
    dispatched.push(action);
    return action;
  };
  const wallet = { getNetworkObject: () => new Network(walletNetwork) };
  const task = runSaga(
    {
      dispatch,
      getState: () => ({ wallet, networkSettings: { network: settingsNetwork }, ...state }),
      effectMiddlewares: [stubMiddleware],
    },
    processRequest,
    { payload: { id: REQUEST_ID, topic: TOPIC, params: { request } } },
  );
  await task.toPromise();
  return dispatched;
}

afterEach(() => {
  jest.clearAllMocks();
});

describe("a dApp request that pays the chain transfer's address", () => {
  const MULTICHAIN_ON = {
    featureToggles: { [MULTICHAIN_FEATURE_TOGGLE]: true },
    fullNodeNetworkName: 'testnet-juliet',
  };

  test('is refused before anything is built, behind the multichain flag', async () => {
    const dispatched = await runProcessRequest(sendTo(TRANSFER_ADDRESS), { state: MULTICHAIN_ON });
    expect(handleRpcRequest).not.toHaveBeenCalled();
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
      topic: TOPIC,
      response: {
        id: REQUEST_ID,
        jsonrpc: '2.0',
        error: { code: INVALID_PAYLOAD, message: expect.any(String) },
      },
    });
    expect(dispatched).toContainEqual({
      type: types.SET_REOWN_MODAL,
      payload: {
        show: true,
        type: 'RequestError',
        data: { errorMessage: expect.stringContaining('moves HTR to Hathor Next') },
      },
    });
  });

  test('goes on as before with the flag off', async () => {
    handleRpcRequest.mockResolvedValue({ type: 'SendTransactionResponse', response: {} });
    await runProcessRequest(sendTo(TRANSFER_ADDRESS), {
      state: { ...MULTICHAIN_ON, featureToggles: {} },
    });
    expect(handleRpcRequest).toHaveBeenCalled();
  });
});
