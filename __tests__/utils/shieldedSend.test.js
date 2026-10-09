/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';
import { EventEmitter } from 'events';
import { constants, shielded } from '@hathor/wallet-lib';
import { DEFAULT_PRIVACY_MODE, PRIVACY_MODE } from '../../src/constants';
import {
  MAX_PRIVATE_AMOUNT,
  buildSendOutput,
  getPrivacyModeOptions,
  initialPrivacyMode,
  isPrivateAmountAllowed,
  privacyModeToShieldedMode,
  waitForWalletReady,
} from '../../src/utils/shieldedSend';

describe('getPrivacyModeOptions', () => {
  test('gives a legacy address only public sends', () => {
    expect(getPrivacyModeOptions(false)).toEqual([PRIVACY_MODE.PUBLIC]);
  });

  test('gives a private address only private sends', () => {
    expect(getPrivacyModeOptions(true)).toEqual([PRIVACY_MODE.HIDE_AMOUNT, PRIVACY_MODE.PRIVATE]);
  });
});

describe('initialPrivacyMode', () => {
  test('starts a send to a private address in the default mode, Hide amount', () => {
    expect(DEFAULT_PRIVACY_MODE).toBe(PRIVACY_MODE.HIDE_AMOUNT);
    expect(initialPrivacyMode(getPrivacyModeOptions(true))).toBe(PRIVACY_MODE.HIDE_AMOUNT);
  });

  test('starts a send to a legacy address in Public', () => {
    expect(initialPrivacyMode(getPrivacyModeOptions(false))).toBe(PRIVACY_MODE.PUBLIC);
  });

  test('takes a preferred mode only where the recipient can take it', () => {
    expect(initialPrivacyMode(getPrivacyModeOptions(true), PRIVACY_MODE.PRIVATE))
      .toBe(PRIVACY_MODE.PRIVATE);
    expect(initialPrivacyMode(getPrivacyModeOptions(true), PRIVACY_MODE.PUBLIC))
      .toBe(PRIVACY_MODE.HIDE_AMOUNT);
    expect(initialPrivacyMode(getPrivacyModeOptions(false), PRIVACY_MODE.PRIVATE))
      .toBe(PRIVACY_MODE.PUBLIC);
  });
});

describe('isPrivateAmountAllowed', () => {
  test('takes amounts below 2^40 base units', () => {
    expect(constants.MAX_SHIELDED_OUTPUT_VALUE).toBe(2n ** 40n);
    expect(MAX_PRIVATE_AMOUNT).toBe(2n ** 40n - 1n);
    expect(isPrivateAmountAllowed(1n)).toBe(true);
    expect(isPrivateAmountAllowed(2n ** 40n - 1n)).toBe(true);
  });

  test('refuses 2^40 base units and more, and zero', () => {
    expect(isPrivateAmountAllowed(2n ** 40n)).toBe(false);
    expect(isPrivateAmountAllowed(2n ** 41n)).toBe(false);
    expect(isPrivateAmountAllowed(0n)).toBe(false);
  });
});

describe('privacyModeToShieldedMode', () => {
  test('maps each privacy mode to its shielded mode', () => {
    expect(privacyModeToShieldedMode(PRIVACY_MODE.PUBLIC)).toBeNull();
    expect(privacyModeToShieldedMode(PRIVACY_MODE.HIDE_AMOUNT))
      .toBe(shielded.ShieldedOutputMode.AMOUNT_SHIELDED);
    expect(privacyModeToShieldedMode(PRIVACY_MODE.PRIVATE))
      .toBe(shielded.ShieldedOutputMode.FULLY_SHIELDED);
  });

  test.each([undefined, null, 'hidden', 1])('throws for %p', (mode) => {
    expect(() => privacyModeToShieldedMode(mode)).toThrow('Unknown privacy mode');
  });
});

describe('buildSendOutput', () => {
  const ADDRESS = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';

  test('writes no shieldedMode key for a public output', () => {
    for (const shieldedMode of [null, undefined]) {
      const output = buildSendOutput({
        address: ADDRESS,
        amount: 100n,
        tokenUid: '00',
        shieldedMode,
      });
      expect(output).toEqual({ address: ADDRESS, value: 100n, token: '00' });
      expect('shieldedMode' in output).toBe(false);
    }
  });

  test('carries the shielded mode of a private output, and the amount as a bigint', () => {
    const output = buildSendOutput({
      address: ADDRESS,
      amount: 2n ** 40n - 1n,
      tokenUid: '00',
      shieldedMode: shielded.ShieldedOutputMode.FULLY_SHIELDED,
    });
    expect(output).toEqual({
      address: ADDRESS,
      value: 2n ** 40n - 1n,
      token: '00',
      shieldedMode: 2,
    });
    expect(typeof output.value).toBe('bigint');
  });
});

describe('waitForWalletReady', () => {
  const createWallet = (ready) => {
    const wallet = new EventEmitter();
    wallet.ready = ready;
    wallet.isReady = jest.fn(() => wallet.ready);
    return wallet;
  };

  test('resolves at once for a ready wallet', async () => {
    const wallet = createWallet(true);
    await expect(waitForWalletReady(wallet).promise).resolves.toBe(true);
    expect(wallet.listenerCount('state')).toBe(0);
  });

  test('resolves once the wallet becomes ready, and stops listening', async () => {
    const wallet = createWallet(false);
    const { promise } = waitForWalletReady(wallet);
    const settled = jest.fn();
    promise.then(settled);

    wallet.emit('state', 'Processing');
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();

    wallet.ready = true;
    wallet.emit('state', 'Ready');
    await expect(promise).resolves.toBe(true);
    expect(wallet.listenerCount('state')).toBe(0);
  });

  test('resolves false when cancelled, and stops listening', async () => {
    const wallet = createWallet(false);
    const { promise, cancel } = waitForWalletReady(wallet);

    cancel();
    await expect(promise).resolves.toBe(false);
    expect(wallet.listenerCount('state')).toBe(0);
  });
});
