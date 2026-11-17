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

/* eslint-disable import/first */
import { runSaga, stdChannel } from 'redux-saga';
import { errors } from '@hathor/wallet-lib';
import { onSessionProposal } from '../../src/sagas/reown';
import { types } from '../../src/actions';
import {
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
/* eslint-enable import/first */

// Testnet addresses built with wallet-lib's address encoders from fixed keys.
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const SHIELDED = 'K3KokZRo7DyNRRiyijpsVix2VADrd4HeA8vWLR5itAj81BVC4Vv7xoXbrYyKYwsLMWhefXqXKgJvC6HcVkDuJ7AJ7qUMS7fVc';

// The state of a seed wallet on the shielded testnet, on the fullnode facade, with the flag on and
// a ready provider: the shielded environment.
const SHIELDED_ENVIRONMENT = {
  featureToggles: { [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: true },
  useWalletService: false,
  fullNodeNetworkName: FULL_NETWORK_SHIELDED_TESTNET,
  shielded: { providerStatus: SHIELDED_PROVIDER_STATUS.READY },
};

const PROPOSAL = {
  proposer: { metadata: { name: 'dapp', url: 'https://dapp.example', icons: [] } },
  requiredNamespaces: { hathor: { chains: ['hathor:testnet'], methods: [] } },
  optionalNamespaces: {},
  relays: [{ protocol: 'irn' }],
};

const walletKit = {
  approveSession: jest.fn(async () => {}),
  rejectSession: jest.fn(async () => {}),
};

// Stub only the client helpers, by name; everything else runs for real.
const stubs = {
  getReownClient: () => ({ walletKit }),
  refreshActiveSessions: () => undefined,
};
const stubMiddleware = (next) => (effect) => {
  const name = effect?.type === 'CALL' ? effect.payload.fn?.name : undefined;
  if (name && stubs[name]) {
    return next(stubs[name]());
  }
  return next(effect);
};

// The address at index 0: the new address on the shielded chain, a legacy one otherwise.
const addressOfChain = async (index, opts) => (opts?.legacy === false ? SHIELDED : P2PKH);

/**
 * Runs a session proposal the user accepts, for a wallet whose address at index 0 is
 * addressOfChain's, unless `getAddressAtIndex` says otherwise. It returns the wallet and the
 * actions the saga dispatched.
 */
async function runAcceptedProposal(state = {}, { getAddressAtIndex = addressOfChain } = {}) {
  const channel = stdChannel();
  const wallet = { getAddressAtIndex: jest.fn(getAddressAtIndex) };
  const dispatched = [];
  const dispatch = (action) => {
    dispatched.push(action);
    // The user accepts once the connect modal shows.
    if (action.type === types.SET_REOWN_MODAL && action.payload?.onAcceptAction) {
      setTimeout(() => channel.put(action.payload.onAcceptAction), 0);
    }
    return action;
  };
  const task = runSaga(
    {
      channel,
      dispatch,
      getState: () => ({ wallet, networkSettings: { network: 'testnet' }, ...state }),
      effectMiddlewares: [stubMiddleware],
    },
    onSessionProposal,
    { payload: { id: 7, params: PROPOSAL } },
  );
  await task.toPromise();
  return { wallet, dispatched };
}

const approvedAccounts = () => walletKit.approveSession.mock.calls[0][0].namespaces.hathor.accounts;

afterEach(() => {
  jest.clearAllMocks();
});

describe('onSessionProposal', () => {
  test('gives the dApp the new address in the shielded environment', async () => {
    const { wallet } = await runAcceptedProposal(SHIELDED_ENVIRONMENT);

    expect(wallet.getAddressAtIndex).toHaveBeenCalledWith(0, { legacy: false });
    expect(approvedAccounts()).toEqual([`hathor:testnet:${SHIELDED}`]);
  });

  test.each([
    ['the flag is off', { ...SHIELDED_ENVIRONMENT, featureToggles: { [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: false } }],
    ['on the wallet-service facade', {
      ...SHIELDED_ENVIRONMENT,
      useWalletService: true,
      shielded: { providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED },
    }],
    ['on another network', {}],
  ])('gives the dApp the legacy address when %s', async (_label, state) => {
    const { wallet } = await runAcceptedProposal(state);

    expect(wallet.getAddressAtIndex).toHaveBeenCalledWith(0, { legacy: true });
    expect(approvedAccounts()).toEqual([`hathor:testnet:${P2PKH}`]);
  });

  test.each([
    ['shielded-no-provider', 'Private transfers could not be loaded on this device.'],
    ['shielded-no-keys', 'Private transfers are not available for this wallet.'],
  ])('refuses the session, and says why, when the new address is refused (%s)', async (code, message) => {
    const { dispatched } = await runAcceptedProposal(SHIELDED_ENVIRONMENT, {
      getAddressAtIndex: async () => {
        throw new errors.ShieldedKeyError(code, 'The wallet gives no shielded address.');
      },
    });

    // No legacy address stands in for it.
    expect(walletKit.approveSession).not.toHaveBeenCalled();
    expect(walletKit.rejectSession).toHaveBeenCalledWith({
      id: 7,
      reason: { code: expect.any(Number), message: expect.any(String) },
    });
    expect(dispatched).toContainEqual({
      type: types.SET_REOWN_MODAL,
      payload: { show: true, type: 'RequestError', data: { errorMessage: message } },
    });
  });
});
