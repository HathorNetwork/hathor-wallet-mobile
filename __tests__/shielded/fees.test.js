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
import {
  getWalletPaidFees,
  isTxPaidByWallet,
  shieldedOutputsFee,
} from '../../src/shielded/fees';
import { logger } from '../../src/logger';
/* eslint-enable import/first */

const log = logger();
const HTR = hathorLibConstants.NATIVE_TOKEN_UID;
const TOKEN = '00000943573723a28e3dd980c10e08419d0e00bc647a95f4ca9671ebea7d5669';
const MINE = 'WMINE';
const MY_SHIELDED_SPEND = 'WMYSPEND';
const THEIRS = 'WTHEIRS';

/**
 * A wallet whose local history holds a tx with these inputs, and whose fullnode reports these
 * fees for it.
 */
function fakeWallet({ inputs = [], fees } = {}) {
  const owned = new Set([MINE, MY_SHIELDED_SPEND]);
  return {
    getTx: jest.fn(async () => ({ tx_id: 'tx1', inputs, outputs: [] })),
    checkAddressesMine: jest.fn(async (addresses) => Object.fromEntries(
      addresses.map((address) => [address, owned.has(address)]),
    )),
    getFullTxById: jest.fn(async () => ({
      success: true,
      tx: { hash: 'tx1', inputs, outputs: [], ...(fees === undefined ? {} : { fees }) },
      meta: {},
    })),
  };
}

const input = (address) => ({ tx_id: 'parent', index: 0, decoded: { type: 'P2PKH', address } });
// A shielded input of another wallet arrives with no value, token or address.
const foreignShieldedInput = { tx_id: 'parent', index: 1, type: 'shielded', commitment: 'c' };

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

describe('isTxPaidByWallet', () => {
  test.each([
    ['one of its transparent inputs is the wallet\'s', [input(THEIRS), input(MINE)]],
    ['one of its shielded inputs is the wallet\'s', [foreignShieldedInput, input(MY_SHIELDED_SPEND)]],
  ])('is true when %s', async (_label, inputs) => {
    expect(await isTxPaidByWallet(fakeWallet({ inputs }), 'tx1')).toBe(true);
  });

  test('is false when no input is the wallet\'s', async () => {
    expect(await isTxPaidByWallet(fakeWallet({ inputs: [input(THEIRS)] }), 'tx1')).toBe(false);
  });

  test('asks nothing about inputs with no address', async () => {
    const wallet = fakeWallet({ inputs: [foreignShieldedInput] });

    expect(await isTxPaidByWallet(wallet, 'tx1')).toBe(false);
    expect(wallet.checkAddressesMine).not.toHaveBeenCalled();
  });

  test('is false for a tx the wallet does not have', async () => {
    const wallet = fakeWallet();
    wallet.getTx.mockResolvedValue(null);

    expect(await isTxPaidByWallet(wallet, 'tx1')).toBe(false);
  });
});

describe('getWalletPaidFees', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reads the HTR fees of a tx the wallet paid, and splits off the privacy fee', async () => {
    const wallet = fakeWallet({
      inputs: [input(MINE)],
      fees: [{ token_uid: HTR, amount: 3 }],
    });

    expect(await getWalletPaidFees(wallet, 'tx1', 2n)).toEqual({
      total: 3n,
      privacy: 2n,
      network: 1n,
    });
    expect(wallet.getFullTxById).toHaveBeenCalledWith('tx1');
  });

  test.each([
    ['a number', 7],
    ['a string', '7'],
    ['a bigint', 7n],
  ])('takes an amount given as %s', async (_label, amount) => {
    const wallet = fakeWallet({ inputs: [input(MINE)], fees: [{ token_uid: HTR, amount }] });

    expect(await getWalletPaidFees(wallet, 'tx1', 0n)).toEqual({
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

    expect((await getWalletPaidFees(wallet, 'tx1', 1n)).total).toBe(3n);
  });

  test('never reports a negative network fee', async () => {
    const wallet = fakeWallet({ inputs: [input(MINE)], fees: [{ token_uid: HTR, amount: 1 }] });

    expect(await getWalletPaidFees(wallet, 'tx1', 2n)).toEqual({
      total: 1n,
      privacy: 2n,
      network: 0n,
    });
  });

  test('is null for a tx the wallet did not pay, without asking the fullnode', async () => {
    const wallet = fakeWallet({ inputs: [input(THEIRS)], fees: [{ token_uid: HTR, amount: 3 }] });

    expect(await getWalletPaidFees(wallet, 'tx1', 2n)).toBeNull();
    expect(wallet.getFullTxById).not.toHaveBeenCalled();
  });

  test.each([
    ['no fees', undefined],
    ['no HTR fee', [{ token_uid: TOKEN, amount: 100 }]],
  ])('is null for a tx with %s', async (_label, fees) => {
    const wallet = fakeWallet({ inputs: [input(MINE)], fees });

    expect(await getWalletPaidFees(wallet, 'tx1', 0n)).toBeNull();
  });

  test('is null, and logged, when the fullnode request fails', async () => {
    const wallet = fakeWallet({ inputs: [input(MINE)] });
    wallet.getFullTxById.mockRejectedValue(new Error('Request failed with status code 503'));

    expect(await getWalletPaidFees(wallet, 'tx1', 0n)).toBeNull();
    expect(log.error).toHaveBeenCalledTimes(1);
  });
});
