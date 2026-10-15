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
  useWalletService = false,
  force = true,
  tokensBalance = {},
} = {}) {
  const state = {
    wallet,
    tokensBalance,
    useWalletService,
    fullNodeNetworkName: FULL_NETWORK_SHIELDED_TESTNET,
    featureToggles: { ...FEATURE_TOGGLE_DEFAULTS, [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag },
    shielded: { providerStatus, providerError: null, capability: null },
  };
  const dispatched = [];
  await runSaga(
    { dispatch: (action) => dispatched.push(action), getState: () => state },
    fetchTokenBalance,
    tokenFetchBalanceRequested(HTR, force),
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

/**
 * A wallet-service facade wallet with 10 HTR available and 3 locked, 4 of the available and 1 of
 * the locked in shielded outputs: the service splits each amount, and the totals include the
 * shielded part.
 */
function fakeWalletServiceWallet() {
  const split = {
    unlocked: { transparent: 6n, shielded: 4n, total: 10n },
    locked: { transparent: 2n, shielded: 1n, total: 3n },
  };
  return {
    getBalance: jest.fn(async (_token, opts) => (opts?.split
      ? [{ balance: split }]
      : [{ balance: { unlocked: 10n, locked: 3n } }])),
    storage: { selectUtxos: jest.fn() },
  };
}

describe('the private part of the available balance on the wallet-service facade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('comes with the balance, from the split the service reads', async () => {
    const wallet = fakeWalletServiceWallet();

    expect(await fetchBalance(wallet, { useWalletService: true, force: false })).toEqual([
      tokenFetchBalanceSuccess(HTR, { available: 10n, locked: 3n, privateAvailable: 4n }),
    ]);
    expect(wallet.getBalance).toHaveBeenCalledTimes(1);
    expect(wallet.getBalance).toHaveBeenCalledWith(HTR, { split: true });
    // The facade's storage holds no UTXOs to sum.
    expect(wallet.storage.selectUtxos).not.toHaveBeenCalled();
  });

  test('is zero for a token the wallet has no balance of', async () => {
    const wallet = fakeWalletServiceWallet();
    wallet.getBalance.mockResolvedValue([]);

    expect(await fetchBalance(wallet, { useWalletService: true, force: false })).toEqual([
      tokenFetchBalanceSuccess(HTR, { available: 0n, locked: 0n, privateAvailable: 0n }),
    ]);
  });

  test('is null when the split cannot be read, and the balance still loads', async () => {
    const wallet = fakeWalletServiceWallet();
    wallet.getBalance.mockImplementation(async (_token, opts) => {
      if (opts?.split) {
        throw new Error('split refused');
      }
      return [{ balance: { unlocked: 10n, locked: 2n } }];
    });

    expect(await fetchBalance(wallet, { useWalletService: true, force: false })).toEqual([
      tokenFetchBalanceSuccess(HTR, { available: 10n, locked: 2n, privateAvailable: null }),
    ]);
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  test('a forced fetch takes a change of the private part alone as a change', async () => {
    const wallet = fakeWalletServiceWallet();
    // A private part that moved while the totals stayed, as a send of the wallet to itself.
    const tokensBalance = {
      [HTR]: { data: { available: 10n, locked: 3n, privateAvailable: 3n } },
    };

    expect(await fetchBalance(wallet, { useWalletService: true, tokensBalance })).toEqual([
      tokenFetchBalanceSuccess(HTR, { available: 10n, locked: 3n, privateAvailable: 4n }),
    ]);
    expect(wallet.getBalance).toHaveBeenCalledTimes(1);
  });

  test('is not read on the wallet-service facade while the shielded UI flag is off', async () => {
    const wallet = fakeWalletServiceWallet();

    expect(await fetchBalance(wallet, { useWalletService: true, flag: false, force: false }))
      .toEqual([tokenFetchBalanceSuccess(HTR, { available: 10n, locked: 3n })]);
    expect(wallet.getBalance).toHaveBeenCalledWith(HTR);
  });
});
