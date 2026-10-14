/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

jest.mock('../../src/shielded/cryptoProvider', () => ({
  loadShieldedCryptoProvider: jest.fn(),
}));

// One shared logger object, so the tests can assert on what the saga logs.
jest.mock('../../src/logger', () => {
  const log = {
    error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn(),
  };
  return { logger: () => log };
});

/* eslint-disable import/first */
import { runSaga } from 'redux-saga';
import { loadShieldedCryptoProvider } from '../../src/shielded/cryptoProvider';
import { logger } from '../../src/logger';
import { registerShieldedCryptoProvider } from '../../src/sagas/shieldedProvider';
import { shieldedProviderUpdate, types } from '../../src/actions';
import { SHIELDED_PROVIDER_STATUS } from '../../src/constants';
/* eslint-enable import/first */

const log = logger();
const PROVIDER = { deriveTag: jest.fn() };

async function register(wallet) {
  const dispatched = [];
  await runSaga(
    { dispatch: (action) => dispatched.push(action) },
    registerShieldedCryptoProvider,
    wallet,
  ).toPromise();
  return dispatched;
}

describe('registerShieldedCryptoProvider', () => {
  let wallet;

  beforeEach(() => {
    jest.clearAllMocks();
    wallet = { setShieldedCryptoProvider: jest.fn() };
  });

  test('registers the provider that passed its self-test', async () => {
    loadShieldedCryptoProvider.mockResolvedValue({ provider: PROVIDER });

    const dispatched = await register(wallet);

    expect(wallet.setShieldedCryptoProvider).toHaveBeenCalledWith(PROVIDER);
    expect(dispatched).toEqual([
      shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }),
    ]);
    expect(dispatched[0].payload).toEqual({ status: SHIELDED_PROVIDER_STATUS.READY, error: null });
    expect(log.error).not.toHaveBeenCalled();
  });

  test('starts the wallet without a provider when the self-test fails', async () => {
    loadShieldedCryptoProvider.mockResolvedValue({
      error: new Error('HathorCtCrypto native module not found.'),
    });

    const dispatched = await register(wallet);

    expect(wallet.setShieldedCryptoProvider).not.toHaveBeenCalled();
    // No alert and nothing for Sentry: only the redux status and the log.
    expect(dispatched).toEqual([shieldedProviderUpdate({
      status: SHIELDED_PROVIDER_STATUS.FAILED,
      error: 'HathorCtCrypto native module not found.',
    })]);
    expect(dispatched.map((action) => action.type)).not.toContain(types.EXCEPTION_CAPTURED);
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  test('reports a provider the wallet refuses as failed', async () => {
    loadShieldedCryptoProvider.mockResolvedValue({ provider: PROVIDER });
    wallet.setShieldedCryptoProvider.mockImplementation(() => {
      throw new Error('Not implemented.');
    });

    const dispatched = await register(wallet);

    expect(dispatched).toEqual([shieldedProviderUpdate({
      status: SHIELDED_PROVIDER_STATUS.FAILED,
      error: 'Not implemented.',
    })]);
    expect(log.error).toHaveBeenCalledTimes(1);
  });
});
