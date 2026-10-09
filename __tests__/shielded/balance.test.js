/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';
import { MemoryStore, Storage, constants as hathorLibConstants } from '@hathor/wallet-lib';
import {
  createPrivateBalanceRequests,
  getPrivateAvailableBalance,
  splitAvailableBalance,
} from '../../src/shielded/balance';

const HTR = hathorLibConstants.NATIVE_TOKEN_UID;
const TOKEN = '00000943573723a28e3dd980c10e08419d0e00bc647a95f4ca9671ebea7d5669';
const nowSeconds = () => Math.floor(Date.now() / 1000);

let nextIndex = 0;
const utxo = (overrides) => {
  nextIndex += 1;
  return {
    txId: `tx${nextIndex}`,
    index: 0,
    token: HTR,
    address: 'WSPEND',
    value: 1n,
    authorities: 0n,
    timelock: null,
    type: 1,
    height: null,
    shielded: true,
    ...overrides,
  };
};

/**
 * A wallet whose storage, wallet-lib's own, holds these UTXOs. The reserved ones are selected as
 * inputs of a send that isn't confirmed yet.
 */
async function walletWith(utxos, { reserved = [] } = {}) {
  const store = new MemoryStore();
  const storage = new Storage(store);
  await Promise.all(utxos.map((entry) => store.saveUtxo(entry)));
  for (const entry of reserved) {
    storage.utxosSelectedAsInput.set(`${entry.txId}:${entry.index}`, true);
  }
  return { storage };
}

describe('getPrivateAvailableBalance', () => {
  test('sums the shielded UTXOs of the token, and only those', async () => {
    const wallet = await walletWith([
      utxo({ value: 5n }),
      utxo({ value: 7n }),
      utxo({ value: 100n, shielded: false }),
      utxo({ value: 3n, token: TOKEN }),
    ]);

    expect(await getPrivateAvailableBalance(wallet, HTR)).toBe(12n);
    expect(await getPrivateAvailableBalance(wallet, TOKEN)).toBe(3n);
  });

  test('leaves a timelocked UTXO out until its timelock passes', async () => {
    const wallet = await walletWith([
      utxo({ value: 4n, timelock: nowSeconds() + 3600 }),
      utxo({ value: 6n, timelock: nowSeconds() - 3600 }),
    ]);

    expect(await getPrivateAvailableBalance(wallet, HTR)).toBe(6n);
  });

  test('counts a UTXO a pending send reserved, as the available balance does', async () => {
    const reserved = utxo({ value: 9n });
    const wallet = await walletWith([reserved, utxo({ value: 1n })], { reserved: [reserved] });
    const selectUtxos = jest.spyOn(wallet.storage, 'selectUtxos');

    expect(await getPrivateAvailableBalance(wallet, HTR)).toBe(10n);
    expect(selectUtxos).toHaveBeenCalledTimes(1);
    expect(selectUtxos.mock.calls[0][0]).toEqual(expect.objectContaining({
      token: HTR,
      shielded: true,
    }));
    expect(selectUtxos.mock.calls[0][0].only_available_utxos).toBeUndefined();
  });

  test('leaves authority UTXOs out', async () => {
    const wallet = await walletWith([
      utxo({ value: 1n, token: TOKEN, authorities: 1n }),
      utxo({ value: 2n, token: TOKEN }),
    ]);

    expect(await getPrivateAvailableBalance(wallet, TOKEN)).toBe(2n);
  });

  test('is 0 without shielded UTXOs', async () => {
    const wallet = await walletWith([utxo({ value: 8n, shielded: false })]);

    expect(await getPrivateAvailableBalance(wallet, HTR)).toBe(0n);
  });
});

describe('splitAvailableBalance', () => {
  test.each([
    ['part of it private', 10n, 4n, 4n, 6n],
    ['nothing private', 10n, 0n, 0n, 10n],
    ['all of it private', 10n, 10n, 10n, 0n],
    ['nothing at all', 0n, 0n, 0n, 0n],
    ['more private than available, as a read during a walk can be', 5n, 8n, 5n, 0n],
  ])('splits a balance with %s', (_label, available, privateAvailable, expectedPrivate, expectedPublic) => {
    const split = splitAvailableBalance(available, privateAvailable);

    expect(split).toEqual({ privateAvailable: expectedPrivate, publicAvailable: expectedPublic });
    expect(split.privateAvailable + split.publicAvailable).toBe(available);
  });
});

describe('createPrivateBalanceRequests', () => {
  test('asks once per token for a balance without its private part', () => {
    const requests = createPrivateBalanceRequests();
    const ask = (tokenUid, privateAvailable) => requests.shouldRequest({
      splitAvailable: true,
      balanceLoaded: true,
      tokenUid,
      privateAvailable,
    });

    expect(ask(HTR, undefined)).toBe(true);
    expect(ask(HTR, undefined)).toBe(false);
    expect(ask(TOKEN, undefined)).toBe(true);
  });

  test('never asks when the private part is known, or failed', () => {
    const requests = createPrivateBalanceRequests();
    const ask = (privateAvailable) => requests.shouldRequest({
      splitAvailable: true,
      balanceLoaded: true,
      tokenUid: HTR,
      privateAvailable,
    });

    expect(ask(5n)).toBe(false);
    expect(ask(null)).toBe(false);
  });

  test('asks again once the split turns off and on', () => {
    const requests = createPrivateBalanceRequests();
    const ask = (splitAvailable) => requests.shouldRequest({
      splitAvailable,
      balanceLoaded: true,
      tokenUid: HTR,
      privateAvailable: undefined,
    });

    expect(ask(true)).toBe(true);
    expect(ask(false)).toBe(false);
    expect(ask(true)).toBe(true);
    expect(ask(true)).toBe(false);
  });

  test('waits until the wallet\'s start loaded the balance', () => {
    const requests = createPrivateBalanceRequests();
    const ask = (balanceLoaded) => requests.shouldRequest({
      splitAvailable: true,
      balanceLoaded,
      tokenUid: HTR,
      privateAvailable: undefined,
    });

    expect(ask(false)).toBe(false);
    expect(ask(false)).toBe(false);
    expect(ask(true)).toBe(true);
    expect(ask(true)).toBe(false);
  });

  test('forgets what it asked for while the split is off, during a start too', () => {
    const requests = createPrivateBalanceRequests();
    const ask = (splitAvailable, balanceLoaded) => requests.shouldRequest({
      splitAvailable,
      balanceLoaded,
      tokenUid: HTR,
      privateAvailable: undefined,
    });

    expect(ask(true, true)).toBe(true);
    // A reload: the split is off while the provider is registered again, then the start loads
    // the balance without its private part, as when the flag was off meanwhile.
    expect(ask(false, false)).toBe(false);
    expect(ask(true, false)).toBe(false);
    expect(ask(true, true)).toBe(true);
  });
});
