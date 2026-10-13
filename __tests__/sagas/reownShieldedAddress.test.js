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
import { Address, Network } from '@hathor/wallet-lib';
import { handleRpcRequest } from '@hathor/hathor-rpc-handler';
import { processRequest } from '../../src/sagas/reown';
import { types } from '../../src/actions';
import { shieldedAddressNotSupportedText } from '../../src/utils';
/* eslint-enable import/first */

// Testnet addresses built with wallet-lib's address encoders from fixed keys.
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const P2SH = 'wYcywVdpeZCGzVW9DBQetyvXzWFnQXkhBf';
const SHIELDED = 'K3KokZRo7DyNRRiyijpsVix2VADrd4HeA8vWLR5itAj81BVC4Vv7xoXbrYyKYwsLMWhefXqXKgJvC6HcVkDuJ7AJ7qUMS7fVc';

const NC_ID = '000063f99b133c7630bc9d0117919f5b8726155412ad063dbbd618bdc7f85d7a';
const TOKEN_UID = '00000943573723a28e3dd980c10e08419d0e00bc647a95f4ca9671ebea7d5669';
const TOPIC = 'topic-1';
const REQUEST_ID = 42;
const INVALID_PAYLOAD = 5003;

const createTokenParams = {
  network: 'testnet',
  name: 'Token',
  symbol: 'TKN',
  amount: '100',
  version: 'deposit',
};
const nanoParams = { network: 'testnet', method: 'run', nc_id: NC_ID, args: [] };
const nanoCreateTokenParams = (address, options = {}, actions = []) => ({
  method: 'initialize',
  address,
  data: { nc_id: NC_ID, actions, args: [] },
  createTokenOptions: {
    name: 'Token',
    symbol: 'TKN',
    amount: '100',
    version: 'deposit',
    contractPaysTokenDeposit: false,
    ...options,
  },
});

// Every request field that takes an address, as a builder of the raw dApp request.
const ADDRESS_FIELDS = [
  ['htr_sendTransaction output address', (address) => ({
    method: 'htr_sendTransaction',
    params: { network: 'testnet', outputs: [{ address: P2PKH, value: '10' }, { address, value: '5' }] },
  })],
  ['htr_sendTransaction changeAddress', (address) => ({
    method: 'htr_sendTransaction',
    params: { network: 'testnet', outputs: [{ address: P2PKH, value: '10' }], changeAddress: address },
  })],
  ['htr_createToken address', (address) => ({
    method: 'htr_createToken', params: { ...createTokenParams, address },
  })],
  ['htr_createToken change_address', (address) => ({
    method: 'htr_createToken', params: { ...createTokenParams, change_address: address },
  })],
  ['htr_createToken mint_authority_address', (address) => ({
    method: 'htr_createToken', params: { ...createTokenParams, mint_authority_address: address },
  })],
  ['htr_createToken melt_authority_address', (address) => ({
    method: 'htr_createToken', params: { ...createTokenParams, melt_authority_address: address },
  })],
  ['htr_sendNanoContractTx withdrawal address', (address) => ({
    method: 'htr_sendNanoContractTx',
    params: { ...nanoParams, actions: [{ type: 'withdrawal', token: '00', amount: '1', address }] },
  })],
  ['htr_sendNanoContractTx deposit address', (address) => ({
    method: 'htr_sendNanoContractTx',
    params: { ...nanoParams, actions: [{ type: 'deposit', token: '00', amount: '1', address }] },
  })],
  ['htr_sendNanoContractTx deposit changeAddress', (address) => ({
    method: 'htr_sendNanoContractTx',
    params: {
      ...nanoParams,
      actions: [{ type: 'deposit', token: '00', amount: '1', changeAddress: address }],
    },
  })],
  ['htr_sendNanoContractTx grant_authority authorityAddress', (address) => ({
    method: 'htr_sendNanoContractTx',
    params: {
      ...nanoParams,
      actions: [{ type: 'grant_authority', token: TOKEN_UID, authority: 'mint', authorityAddress: address }],
    },
  })],
  ['htr_sendNanoContractTx acquire_authority address', (address) => ({
    method: 'htr_sendNanoContractTx',
    params: {
      ...nanoParams,
      actions: [{ type: 'acquire_authority', token: TOKEN_UID, authority: 'mint', address }],
    },
  })],
  ['htr_createNanoContractCreateTokenTx address', (address) => ({
    method: 'htr_createNanoContractCreateTokenTx', params: nanoCreateTokenParams(address),
  })],
  ['htr_createNanoContractCreateTokenTx mintAddress', (address) => ({
    method: 'htr_createNanoContractCreateTokenTx',
    params: nanoCreateTokenParams(P2PKH, { mintAddress: address }),
  })],
  ['htr_createNanoContractCreateTokenTx changeAddress', (address) => ({
    method: 'htr_createNanoContractCreateTokenTx',
    params: nanoCreateTokenParams(P2PKH, { changeAddress: address }),
  })],
  ['htr_createNanoContractCreateTokenTx mintAuthorityAddress', (address) => ({
    method: 'htr_createNanoContractCreateTokenTx',
    params: nanoCreateTokenParams(P2PKH, { mintAuthorityAddress: address }),
  })],
  ['htr_createNanoContractCreateTokenTx meltAuthorityAddress', (address) => ({
    method: 'htr_createNanoContractCreateTokenTx',
    params: nanoCreateTokenParams(P2PKH, { meltAuthorityAddress: address }),
  })],
  ['htr_createNanoContractCreateTokenTx action address', (address) => ({
    method: 'htr_createNanoContractCreateTokenTx',
    params: nanoCreateTokenParams(P2PKH, {}, [{ type: 'withdrawal', token: '00', amount: '1', address }]),
  })],
  // Nano contract method arguments of type Address, alone or inside list, tuple, dict and
  // SignedData arguments.
  ['htr_sendNanoContractTx argument', (address) => ({
    method: 'htr_sendNanoContractTx', params: { ...nanoParams, args: [address] },
  })],
  ['htr_sendNanoContractTx list argument', (address) => ({
    method: 'htr_sendNanoContractTx', params: { ...nanoParams, args: [[P2PKH, address]] },
  })],
  ['htr_sendNanoContractTx tuple argument', (address) => ({
    method: 'htr_sendNanoContractTx', params: { ...nanoParams, args: ['memo', [address, 5]] },
  })],
  ['htr_sendNanoContractTx dict argument key', (address) => ({
    method: 'htr_sendNanoContractTx', params: { ...nanoParams, args: [{ [address]: 5 }] },
  })],
  ['htr_sendNanoContractTx dict argument value', (address) => ({
    method: 'htr_sendNanoContractTx', params: { ...nanoParams, args: [{ payee: address }] },
  })],
  ['htr_sendNanoContractTx SignedData argument value', (address) => ({
    method: 'htr_sendNanoContractTx',
    params: { ...nanoParams, args: [{ type: 'Address', signature: 'abcd', value: address }] },
  })],
  ['htr_createNanoContractCreateTokenTx argument', (address) => ({
    method: 'htr_createNanoContractCreateTokenTx',
    params: {
      ...nanoCreateTokenParams(P2PKH),
      data: { nc_id: NC_ID, actions: [], args: [[address]] },
    },
  })],
  ['htr_signOracleData oracle', (address) => ({
    method: 'htr_signOracleData',
    params: { network: 'testnet', nc_id: NC_ID, oracle: address, data: 'result' },
  })],
  ['htr_getUtxos filterAddress', (address) => ({
    method: 'htr_getUtxos', params: { network: 'testnet', filterAddress: address },
  })],
];

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

async function runProcessRequest(request, { walletNetwork = 'testnet', settingsNetwork = 'testnet' } = {}) {
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
      getState: () => ({ wallet, networkSettings: { network: settingsNetwork } }),
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

describe('processRequest with shielded addresses', () => {
  test.each(ADDRESS_FIELDS)('rejects a shielded address in the %s', async (_field, buildRequest) => {
    const dispatched = await runProcessRequest(buildRequest(SHIELDED));

    // The request never reaches the rpc handler, so nothing is built or prompted.
    expect(handleRpcRequest).not.toHaveBeenCalled();
    expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(1);
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
        data: { errorMessage: shieldedAddressNotSupportedText },
      },
    });
  });

  test.each(ADDRESS_FIELDS)('passes P2PKH and P2SH addresses in the %s to the rpc handler', async (_field, buildRequest) => {
    handleRpcRequest.mockResolvedValue({ type: 'test-response' });

    await runProcessRequest(buildRequest(P2PKH));
    await runProcessRequest(buildRequest(P2SH));

    expect(handleRpcRequest).toHaveBeenCalledTimes(2);
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith(expect.objectContaining({
      response: expect.objectContaining({ result: { type: 'test-response' } }),
    }));
  });

  test('passes requests without addresses to the rpc handler', async () => {
    handleRpcRequest.mockResolvedValue({ type: 'test-response' });

    await runProcessRequest({ method: 'htr_getBalance', params: { network: 'testnet', tokens: ['00'] } });

    expect(handleRpcRequest).toHaveBeenCalledTimes(1);
  });

  test('checks the addresses on the network of the wallet that builds the transaction', async () => {
    // The network settings can name another network while the wallet restarts on a new one.
    const request = {
      method: 'htr_sendTransaction',
      params: { network: 'testnet', outputs: [{ address: SHIELDED, value: '5' }] },
    };
    await runProcessRequest(request, { walletNetwork: 'testnet', settingsNetwork: 'mainnet' });

    expect(handleRpcRequest).not.toHaveBeenCalled();
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith(expect.objectContaining({
      response: expect.objectContaining({
        error: { code: INVALID_PAYLOAD, message: expect.any(String) },
      }),
    }));
  });
});

describe('processRequest with strings too long to be addresses', () => {
  // Decoding base58 takes time quadratic in the length of the string, and the dApp decides how
  // long its strings are.
  const LONG_STRING = 'z'.repeat(40000);

  // The lengths of the strings that wallet-lib decoded from base58.
  const decodedLengths = (decode) => decode.mock.contexts.map((address) => address.base58.length);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    ['an output address', (string) => ({
      method: 'htr_sendTransaction',
      params: { network: 'testnet', outputs: [{ address: string, value: '5' }] },
    })],
    ['a nano contract argument', (string) => ({
      method: 'htr_sendNanoContractTx', params: { ...nanoParams, args: [string] },
    })],
  ])('passes a 40,000-character string as %s to the rpc handler without decoding it', async (_field, buildRequest) => {
    handleRpcRequest.mockResolvedValue({ type: 'test-response' });
    const decode = jest.spyOn(Address.prototype, 'decode');

    await runProcessRequest(buildRequest(LONG_STRING));

    expect(decodedLengths(decode)).not.toContain(LONG_STRING.length);
    expect(handleRpcRequest).toHaveBeenCalledTimes(1);
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith(expect.objectContaining({
      response: expect.objectContaining({ result: { type: 'test-response' } }),
    }));
  });

  test('rejects a shielded address that comes after a 40,000-character string', async () => {
    const decode = jest.spyOn(Address.prototype, 'decode');
    const request = {
      method: 'htr_sendNanoContractTx',
      params: { ...nanoParams, args: [LONG_STRING, SHIELDED] },
    };

    const dispatched = await runProcessRequest(request);

    expect(decodedLengths(decode)).not.toContain(LONG_STRING.length);
    expect(handleRpcRequest).not.toHaveBeenCalled();
    expect(walletKit.respondSessionRequest).toHaveBeenCalledTimes(1);
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
        data: { errorMessage: shieldedAddressNotSupportedText },
      },
    });
  });
});
