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
  computeSendFees,
  getPrivacyModeOptions,
  initialPrivacyMode,
  isPrivateAmountAllowed,
  mapShieldedSendError,
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

describe('computeSendFees', () => {
  const AS = { shieldedMode: 1 };
  const FS = { shieldedMode: 2 };
  // A prepared send, as wallet-lib leaves it: its tx with a fee header, and the data it was
  // built from, with its shielded outputs (change and split outputs included).
  const prepared = (entries, shieldedOutputs) => ({
    transaction: { getFeeHeader: () => (entries ? { entries } : null) },
    fullTxData: shieldedOutputs ? { shieldedOutputs } : { inputs: [], outputs: [] },
  });

  test('is all zero for a send without a fee header', () => {
    expect(computeSendFees(prepared(null))).toEqual({
      total: 0n, privacy: 0n, network: 0n, privateOutputs: 0,
    });
  });

  test('bills 1 per amount-shielded and 2 per fully shielded output', () => {
    expect(computeSendFees(prepared([{ tokenIndex: 0, amount: 3n }], [AS, FS]))).toEqual({
      total: 3n, privacy: 3n, network: 0n, privateOutputs: 2,
    });
  });

  test('reads the shieldedMode of the prepared outputs, not the mode of history entries', () => {
    // A history entry's `mode: 2` is not what the prepared tx gives: it bills as amount-shielded.
    const fees = computeSendFees(prepared([{ tokenIndex: 0, amount: 2n }], [{ mode: 2 }, AS]));
    expect(fees.privacy).toBe(2n);
  });

  test('leaves the rest of the total as the network fee, as a fee-based token pays', () => {
    expect(computeSendFees(prepared([{ tokenIndex: 0, amount: 4n }], [AS, AS]))).toEqual({
      total: 4n, privacy: 2n, network: 2n, privateOutputs: 2,
    });
  });

  test('sums the HTR entries of the fee header', () => {
    const fees = computeSendFees(prepared(
      [{ tokenIndex: 0, amount: 1n }, { tokenIndex: 0, amount: 2n }],
      [AS],
    ));
    expect(fees.total).toBe(3n);
    expect(fees.network).toBe(2n);
  });

  test('throws on a fee entry in another token', () => {
    expect(() => computeSendFees(prepared([{ tokenIndex: 1, amount: 1n }], [])))
      .toThrow('Unexpected fee entry with non-HTR token index');
  });

  test('bills no privacy fee for a send of the wallet-service facade', () => {
    const entries = [{ tokenIndex: 0, amount: 1n }];
    const send = { transaction: { getFeeHeader: () => ({ entries }) } };
    expect(computeSendFees(send)).toEqual({
      total: 1n, privacy: 0n, network: 1n, privateOutputs: 0,
    });
  });
});

describe('mapShieldedSendError', () => {
  test('gives no copy for an error that is not about private sends', () => {
    expect(mapShieldedSendError(new Error('Transaction has 256 outputs and can have at most 255.')))
      .toBeNull();
    expect(mapShieldedSendError(new Error('Token: 00. Insufficient amount of tokens to fill the amount.')))
      .toBeNull();
    expect(mapShieldedSendError(null)).toBeNull();
    expect(mapShieldedSendError({})).toBeNull();
  });

  test('maps by the message alone where the error lost its type', () => {
    // A dApp's send reaches the app wrapped by the rpc handler, with the message only.
    const message = 'A shielded change is required, but the wallet has no shielded address to receive it.';
    expect(mapShieldedSendError({ message }))
      .toBe('This wallet cannot receive the private change this transaction needs.');
  });
});
