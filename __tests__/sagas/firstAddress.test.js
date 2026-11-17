/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';
import { runSaga } from 'redux-saga';
import { errors } from '@hathor/wallet-lib';
import { fetchFirstWalletAddress } from '../../src/sagas/wallet';
import { getFirstAddress } from '../../src/utils';
import { types } from '../../src/actions';
import {
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';

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

// A wallet whose address at index 0 is the new address on the shielded chain, legacy otherwise.
const createWallet = () => ({
  isReady: () => true,
  getAddressAtIndex: jest.fn(async (index, opts) => (opts?.legacy === false ? SHIELDED : P2PKH)),
});

async function runFetchFirstAddress(state, wallet = createWallet()) {
  const dispatched = [];
  await runSaga(
    {
      dispatch: (action) => dispatched.push(action),
      getState: () => ({ wallet, ...state }),
    },
    fetchFirstWalletAddress,
  ).toPromise();
  return { wallet, dispatched };
}

describe('getFirstAddress', () => {
  test('reads the legacy address at index 0', async () => {
    const wallet = createWallet();

    await expect(getFirstAddress(wallet)).resolves.toBe(P2PKH);
    expect(wallet.getAddressAtIndex).toHaveBeenCalledWith(0);
  });
});

// The first address is where a nano contract registration and a dApp's nano contract request
// start their caller from. Nano contract callers are legacy addresses on every network.
describe('fetchFirstWalletAddress', () => {
  test.each([
    ['in the shielded environment', SHIELDED_ENVIRONMENT],
    ['when the flag is off', { ...SHIELDED_ENVIRONMENT, featureToggles: { [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: false } }],
    ['on another network', {}],
  ])('gives the legacy address %s', async (_label, state) => {
    const { wallet, dispatched } = await runFetchFirstAddress(state);

    expect(wallet.getAddressAtIndex).toHaveBeenCalledWith(0);
    expect(dispatched).toContainEqual({
      type: types.FIRSTADDRESS_SUCCESS,
      payload: { address: P2PKH },
    });
  });

  test('says the first address could not be loaded, whatever the error', async () => {
    const wallet = createWallet();
    wallet.getAddressAtIndex.mockRejectedValue(
      new errors.ShieldedKeyError('shielded-no-provider', 'No shielded crypto provider is registered.'),
    );
    const { dispatched } = await runFetchFirstAddress(SHIELDED_ENVIRONMENT, wallet);

    expect(dispatched).toContainEqual({
      type: types.FIRSTADDRESS_FAILURE,
      payload: { error: 'There was an error while loading first wallet address. Try again.' },
    });
  });
});
