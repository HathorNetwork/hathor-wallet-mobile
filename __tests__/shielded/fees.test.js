/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// One shared logger object, so the tests can assert on what the helpers log.
jest.mock('../../src/logger', () => {
  const log = {
    error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn(),
  };
  return { logger: () => log };
});

/* eslint-disable import/first */
import { constants as hathorLibConstants } from '@hathor/wallet-lib';
import { getTxFees, shieldedOutputsFee } from '../../src/shielded/fees';
import { logger } from '../../src/logger';
/* eslint-enable import/first */

const log = logger();
const HTR = hathorLibConstants.NATIVE_TOKEN_UID;
const TOKEN = '00000943573723a28e3dd980c10e08419d0e00bc647a95f4ca9671ebea7d5669';
const MINE = 'WMINE';
const THEIRS = 'WTHEIRS';

/**
 * A wallet whose fullnode reports a tx with these inputs and these fees.
 */
function fakeWallet({ inputs = [], fees } = {}) {
  return {
    getFullTxById: jest.fn(async () => ({
      success: true,
      tx: { hash: 'tx1', inputs, outputs: [], ...(fees === undefined ? {} : { fees }) },
      meta: {},
    })),
  };
}

const input = (address) => ({ tx_id: 'parent', index: 0, decoded: { type: 'P2PKH', address } });

describe('shieldedOutputsFee', () => {
  test('charges 1 per amount-shielded output and 2 per fully shielded one', () => {
    expect(shieldedOutputsFee([{ mode: 1 }, { mode: 2 }, { mode: 1 }])).toBe(4n);
    expect(shieldedOutputsFee([])).toBe(0n);
    expect(shieldedOutputsFee(undefined)).toBe(0n);
  });

  test('falls back to the asset commitment when the mode is missing', () => {
    expect(shieldedOutputsFee([{ asset_commitment: 'a' }, { commitment: 'c' }])).toBe(3n);
  });
});

describe('getTxFees', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reads the HTR fees of a tx the wallet paid, and splits off the privacy fee', async () => {
    const wallet = fakeWallet({
      inputs: [input(MINE)],
      fees: [{ token_uid: HTR, amount: 3 }],
    });

    expect(await getTxFees(wallet, 'tx1', 2n)).toEqual({
      total: 3n,
      privacy: 2n,
      network: 1n,
    });
    expect(wallet.getFullTxById).toHaveBeenCalledWith('tx1');
  });

  test('reads the fees of a tx the wallet received', async () => {
    const wallet = fakeWallet({ inputs: [input(THEIRS)], fees: [{ token_uid: HTR, amount: 3 }] });

    expect(await getTxFees(wallet, 'tx1', 2n)).toEqual({
      total: 3n,
      privacy: 2n,
      network: 1n,
    });
  });

  test.each([
    ['a number', 7],
    ['a string', '7'],
    ['a bigint', 7n],
  ])('takes an amount given as %s', async (_label, amount) => {
    const wallet = fakeWallet({ inputs: [input(MINE)], fees: [{ token_uid: HTR, amount }] });

    expect(await getTxFees(wallet, 'tx1', 0n)).toEqual({
      total: 7n,
      privacy: 0n,
      network: 7n,
    });
  });

  test('adds up the HTR entries and leaves the other tokens out', async () => {
    const wallet = fakeWallet({
      inputs: [input(MINE)],
      fees: [
        { token_uid: HTR, amount: 2 },
        { token_uid: TOKEN, amount: 100 },
        { token_uid: HTR, amount: 1 },
      ],
    });

    expect((await getTxFees(wallet, 'tx1', 1n)).total).toBe(3n);
  });

  test('never reports a negative network fee', async () => {
    const wallet = fakeWallet({ inputs: [input(MINE)], fees: [{ token_uid: HTR, amount: 1 }] });

    expect(await getTxFees(wallet, 'tx1', 2n)).toEqual({
      total: 1n,
      privacy: 2n,
      network: 0n,
    });
  });

  test.each([
    ['no fees', undefined],
    ['no HTR fee', [{ token_uid: TOKEN, amount: 100 }]],
    ['an HTR fee of zero', [{ token_uid: HTR, amount: 0 }]],
  ])('is null for a tx with %s', async (_label, fees) => {
    const wallet = fakeWallet({ inputs: [input(MINE)], fees });

    expect(await getTxFees(wallet, 'tx1', 0n)).toBeNull();
  });

  test('is null, and logged, when the fullnode request fails', async () => {
    const wallet = fakeWallet({ inputs: [input(MINE)] });
    wallet.getFullTxById.mockRejectedValue(new Error('Request failed with status code 503'));

    expect(await getTxFees(wallet, 'tx1', 0n)).toBeNull();
    expect(log.error).toHaveBeenCalledTimes(1);
  });
});
