/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// One shared logger object, so the tests can assert on what the saga logs.
jest.mock('../../src/logger', () => {
  const log = {
    error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn(),
  };
  return { logger: () => log };
});

/* eslint-disable import/first */
import { runSaga } from 'redux-saga';
import { constants as hathorLibConstants } from '@hathor/wallet-lib';
import { fetchTokenBalance } from '../../src/sagas/tokens';
import { tokenFetchBalanceRequested, tokenFetchBalanceSuccess } from '../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import { logger } from '../../src/logger';
/* eslint-enable import/first */

const log = logger();
const HTR = hathorLibConstants.NATIVE_TOKEN_UID;

/**
 * A wallet with 10 HTR available and 2 locked, 4 of the available in shielded UTXOs.
 */
function fakeWallet() {
  return {
    getBalance: jest.fn(async () => [{ balance: { unlocked: 10n, locked: 2n } }]),
    storage: {
      selectUtxos: jest.fn(async function* select() {
        yield { value: 1n, shielded: true, token: HTR };
        yield { value: 3n, shielded: true, token: HTR };
      }),
    },
  };
}

/**
 * Runs fetchTokenBalance on a wallet that runs on the shielded testnet's fullnode facade, with a
 * ready provider, with the shielded UI flag as given.
 */
async function fetchBalance(wallet, {
  flag = true,
  providerStatus = SHIELDED_PROVIDER_STATUS.READY,
} = {}) {
  const state = {
    wallet,
    tokensBalance: {},
    useWalletService: false,
    fullNodeNetworkName: FULL_NETWORK_SHIELDED_TESTNET,
    featureToggles: { ...FEATURE_TOGGLE_DEFAULTS, [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag },
    shielded: { providerStatus, providerError: null, capability: null },
  };
  const dispatched = [];
  await runSaga(
    { dispatch: (action) => dispatched.push(action), getState: () => state },
    fetchTokenBalance,
    tokenFetchBalanceRequested(HTR, true),
  ).toPromise();
  return dispatched;
}

describe('the private part of the available balance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('is read where the balance split shows', async () => {
    const wallet = fakeWallet();

    expect(await fetchBalance(wallet)).toEqual([
      tokenFetchBalanceSuccess(HTR, { available: 10n, locked: 2n, privateAvailable: 4n }),
    ]);
    expect(wallet.storage.selectUtxos).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['the shielded UI flag is off', { flag: false }],
    ['the provider failed its self-test', { providerStatus: SHIELDED_PROVIDER_STATUS.FAILED }],
    ['no provider was tried', { providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED }],
  ])('is not read while %s', async (_label, options) => {
    const wallet = fakeWallet();

    expect(await fetchBalance(wallet, options)).toEqual([
      tokenFetchBalanceSuccess(HTR, { available: 10n, locked: 2n }),
    ]);
    expect(wallet.storage.selectUtxos).not.toHaveBeenCalled();
  });

  test('is null when it cannot be read, and the balance still loads', async () => {
    const wallet = fakeWallet();
    // eslint-disable-next-line require-yield
    wallet.storage.selectUtxos.mockImplementation(async function* fail() {
      throw new Error('storage closed');
    });

    expect(await fetchBalance(wallet)).toEqual([
      tokenFetchBalanceSuccess(HTR, { available: 10n, locked: 2n, privateAvailable: null }),
    ]);
    expect(log.error).toHaveBeenCalledTimes(1);
  });
});
