/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';
import { errors } from '@hathor/wallet-lib';
import { SHIELDED_UNLOCK_STATUS, unlockShieldedViewIfLocked } from '../../src/shielded/unlock';

const PIN = '123456';
const capability = (level, overrides = {}) => ({
  level,
  reason: level === 'full' ? null : 'locked',
  cause: level === 'watch' ? 'wrong-pin' : null,
  canReceive: level === 'view' || level === 'full',
  canSpend: level === 'full',
  historyComplete: true,
  undecoded: { txIds: [], locked: level === 'watch' ? 1 : 0, unreadable: 0, error: 0 },
  ...overrides,
});

function fakeWallet(level, overrides = {}) {
  const unlocked = capability('full');
  const reprocessed = Promise.resolve(unlocked);
  return {
    getShieldedCapability: jest.fn(async () => capability(level, overrides)),
    unlockShieldedView: jest.fn(async () => ({ capability: unlocked, reprocessed })),
    unlocked,
    reprocessed,
  };
}

describe('unlockShieldedViewIfLocked', () => {
  test.each(['none', 'view', 'full'])('leaves a wallet at level %s as it is', async (level) => {
    const wallet = fakeWallet(level);

    const result = await unlockShieldedViewIfLocked(wallet, PIN);

    expect(result).toEqual({
      status: SHIELDED_UNLOCK_STATUS.SKIPPED,
      capability: capability(level),
    });
    expect(wallet.unlockShieldedView).not.toHaveBeenCalled();
  });

  test('skips a wallet-service facade wallet, whose scan key start() unlocked', async () => {
    const wallet = {
      isReady: () => true,
      isShieldedEnabled: () => true,
      storage: { shieldedCryptoProvider: {} },
    };

    const result = await unlockShieldedViewIfLocked(wallet, PIN);

    expect(result).toEqual({
      status: SHIELDED_UNLOCK_STATUS.SKIPPED,
      capability: expect.objectContaining({ level: 'full' }),
    });
  });

  test('skips a wallet without unlockShieldedView, whatever its capability', async () => {
    const wallet = fakeWallet('watch', { cause: 'not-supplied' });
    delete wallet.unlockShieldedView;

    const result = await unlockShieldedViewIfLocked(wallet, PIN);

    expect(result.status).toBe(SHIELDED_UNLOCK_STATUS.SKIPPED);
  });

  test.each(['not-supplied', 'wrong-pin', 'error'])(
    'unlocks a wallet locked with the cause %s with the PIN, without waiting for the walk',
    async (cause) => {
      const wallet = fakeWallet('watch', { cause });

      const result = await unlockShieldedViewIfLocked(wallet, PIN);

      expect(wallet.unlockShieldedView).toHaveBeenCalledWith({ pinCode: PIN });
      expect(result.status).toBe(SHIELDED_UNLOCK_STATUS.UNLOCKED);
      expect(result.capability).toBe(wallet.unlocked);
      expect(result.reprocessed).toBe(wallet.reprocessed);
    },
  );

  test('leaves a wallet locked with a corrupt key as it is: no PIN can unlock it', async () => {
    const wallet = fakeWallet('watch', { cause: 'corrupt-key' });

    const result = await unlockShieldedViewIfLocked(wallet, PIN);

    expect(result).toEqual({
      status: SHIELDED_UNLOCK_STATUS.SKIPPED,
      capability: capability('watch', { cause: 'corrupt-key' }),
    });
    expect(wallet.unlockShieldedView).not.toHaveBeenCalled();
  });

  test.each([
    'shielded-wrong-pin',
    'shielded-corrupt-key',
    'shielded-key-mismatch',
    'shielded-no-keys',
    'shielded-not-started',
  ])('reports the refusal %s without throwing', async (errorCode) => {
    const wallet = fakeWallet('watch');
    wallet.unlockShieldedView.mockRejectedValue(
      new errors.ShieldedKeyError(errorCode, 'The shielded view key was not unlocked.'),
    );

    expect(await unlockShieldedViewIfLocked(wallet, PIN))
      .toEqual({ status: SHIELDED_UNLOCK_STATUS.FAILED, errorCode });
  });

  test('throws any other error', async () => {
    const wallet = fakeWallet('watch');
    const storeError = new Error('store read failed');
    wallet.unlockShieldedView.mockRejectedValue(storeError);

    await expect(unlockShieldedViewIfLocked(wallet, PIN)).rejects.toBe(storeError);
  });
});
