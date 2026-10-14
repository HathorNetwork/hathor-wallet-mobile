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
const PIN_INPUT = { pinCode: PIN };
const SCAN_KEY_INPUT = { scanXPrivKey: 'xprv-scan-key' };
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

    const result = await unlockShieldedViewIfLocked(wallet, PIN_INPUT);

    expect(result).toEqual({
      status: SHIELDED_UNLOCK_STATUS.SKIPPED,
      capability: capability(level),
    });
    expect(wallet.unlockShieldedView).not.toHaveBeenCalled();
  });

  test('skips a wallet-service facade wallet, which has no shielded capability', async () => {
    const wallet = { unlockShieldedView: jest.fn() };

    const result = await unlockShieldedViewIfLocked(wallet, PIN_INPUT);

    expect(result).toEqual({ status: SHIELDED_UNLOCK_STATUS.SKIPPED, capability: null });
    expect(wallet.unlockShieldedView).not.toHaveBeenCalled();
  });

  test.each(['not-supplied', 'wrong-pin', 'error'])(
    'unlocks a wallet locked with the cause %s with the PIN, without waiting for the walk',
    async (cause) => {
      const wallet = fakeWallet('watch', { cause });

      const result = await unlockShieldedViewIfLocked(wallet, PIN_INPUT);

      expect(wallet.unlockShieldedView).toHaveBeenCalledWith({ pinCode: PIN });
      expect(result.status).toBe(SHIELDED_UNLOCK_STATUS.UNLOCKED);
      expect(result.capability).toBe(wallet.unlocked);
      expect(result.reprocessed).toBe(wallet.reprocessed);
    },
  );

  // A passkey wallet unlocks with the scan key a passkey ceremony derived.
  test('unlocks a locked wallet with the scan key it is given', async () => {
    const wallet = fakeWallet('watch', { cause: 'not-supplied' });

    const result = await unlockShieldedViewIfLocked(wallet, SCAN_KEY_INPUT);

    expect(wallet.unlockShieldedView).toHaveBeenCalledWith(SCAN_KEY_INPUT);
    expect(result.status).toBe(SHIELDED_UNLOCK_STATUS.UNLOCKED);
  });

  // 'key-mismatch': the scan key given at start isn't the key of the stored scan xpub, and the
  // same root gives the same key again.
  test.each(['corrupt-key', 'key-mismatch'])(
    'leaves a wallet locked with the cause %s as it is: no unlock can fix it',
    async (cause) => {
      const wallet = fakeWallet('watch', { cause });

      const result = await unlockShieldedViewIfLocked(wallet, SCAN_KEY_INPUT);

      expect(result).toEqual({
        status: SHIELDED_UNLOCK_STATUS.SKIPPED,
        capability: capability('watch', { cause }),
      });
      expect(wallet.unlockShieldedView).not.toHaveBeenCalled();
    },
  );

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

    expect(await unlockShieldedViewIfLocked(wallet, PIN_INPUT))
      .toEqual({ status: SHIELDED_UNLOCK_STATUS.FAILED, errorCode });
  });

  test('throws any other error', async () => {
    const wallet = fakeWallet('watch');
    const storeError = new Error('store read failed');
    wallet.unlockShieldedView.mockRejectedValue(storeError);

    await expect(unlockShieldedViewIfLocked(wallet, PIN_INPUT)).rejects.toBe(storeError);
  });
});
