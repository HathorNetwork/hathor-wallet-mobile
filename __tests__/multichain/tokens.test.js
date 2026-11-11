/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { CHAIN } from '../../src/multichain/chains';
import { nextAmountForDisplay, nextToHathorAmount } from '../../src/multichain/amount';
import { combinedTokenList } from '../../src/multichain/tokens';
import { TRANSFER_STATUS } from '../../src/multichain/state';

const HTR = { uid: '00', name: 'Hathor', symbol: 'HTR' };
const MY_TOKEN = { uid: 'a1', name: 'My Token', symbol: 'MTK' };
const NEXT_TST_A = { id: 'b1', name: 'Test Token', symbol: 'TST', lastActivityAt: 2 };
const NEXT_TST_B = { id: 'b2', name: 'Test Token', symbol: 'TST', lastActivityAt: 1 };
// A Hathor Next token named like a Hathor Network one: a different token all the same.
const NEXT_MTK = { id: 'b3', name: 'My Token', symbol: 'MTK', lastActivityAt: 3 };

const ready = (available) => ({ status: 'ready', data: { available } });

const list = ({ transfers = [], nextHtr = 2500000000n } = {}) => combinedTokenList({
  hathorTokens: { '00': HTR, a1: MY_TOKEN },
  hathorBalances: { '00': ready(9500n), a1: ready(1000n) },
  hathorDecimalPlaces: 2,
  nextTokens: {
    '00': { id: '00', name: 'Hathor', symbol: 'HTR', lastActivityAt: 5 },
    b1: NEXT_TST_A,
    b2: NEXT_TST_B,
    b3: NEXT_MTK,
  },
  nextBalances: {
    '00': ready(nextHtr),
    b1: ready(500000000n),
    b2: ready(100000000n),
    b3: ready(1234567n),
  },
  tokenMap: [{ hathor: '00', next: '00' }],
  // Juliet's pinned scale: 1.00 HTR is 1.00000000 on Hathor Next.
  mintScale: 1000000n,
  nativeTokenId: '00',
  transfers,
});

const transfer = (fields) => ({
  id: 't1',
  from: CHAIN.HATHOR,
  to: CHAIN.HATHOR_NEXT,
  hathorTokenId: '00',
  nextTokenId: '00',
  amount: '2510',
  receiveAmount: '2500000000',
  toOwn: true,
  status: TRANSFER_STATUS.PENDING,
  debitedOnSource: false,
  ...fields,
});

describe('the Dashboard list of both chains', () => {
  test('merges a token the bridge carries into one row, with both balances', () => {
    const [htr] = list();
    expect(htr).toMatchObject({
      uid: '00',
      hathorUid: '00',
      nextId: '00',
      chains: [CHAIN.HATHOR, CHAIN.HATHOR_NEXT],
      // 95.00 + 25.00000000, shown as Hathor Network shows it
      available: 12000n,
      decimalPlaces: 2,
      arriving: null,
    });
  });

  test("merges by the bridge's map, never by name or symbol", () => {
    const rows = list();
    const mtk = rows.filter((row) => row.symbol === 'MTK');
    expect(mtk).toHaveLength(2);
    expect(mtk.map((row) => row.chains)).toEqual([[CHAIN.HATHOR], [CHAIN.HATHOR_NEXT]]);
  });

  test("lists Hathor Network's tokens first, then Hathor Next's own by recent activity", () => {
    expect(list().map((row) => row.uid)).toEqual(['00', 'a1', 'next:b3', 'next:b1', 'next:b2']);
  });

  test('tells Hathor Next tokens that share a symbol apart by their id', () => {
    const names = list().filter((row) => row.symbol === 'TST').map((row) => row.name);
    expect(names).toEqual(['Test Token · b1', 'Test Token · b2']);
  });

  test('shows a Hathor Next amount with all its digits when it has more than Hathor Network', () => {
    const mtk = list().find((row) => row.uid === 'next:b3');
    expect(mtk).toMatchObject({ available: 1234567n, decimalPlaces: 8 });
  });

  test('says what is on its way, and counts it only once it left the other balance', () => {
    // Its transaction hasn't reached Hathor Network yet: the balance there still holds it.
    const notSent = list({ transfers: [transfer({ debitedOnSource: false })] })[0];
    expect(notSent.available).toBe(12000n);
    expect(notSent.arriving).toEqual({ amount: 2500n, decimalPlaces: 2 });

    const sent = list({ transfers: [transfer({ debitedOnSource: true })] })[0];
    expect(sent.available).toBe(14500n);
  });

  test('ignores a transfer that arrived, or that went to another address', () => {
    const [arrived] = list({ transfers: [transfer({ status: TRANSFER_STATUS.ARRIVED })] });
    expect(arrived.arriving).toBeNull();
    const [elsewhere] = list({ transfers: [transfer({ toOwn: false })] });
    expect(elsewhere.arriving).toBeNull();
  });
});

describe('Hathor Next amounts on screen', () => {
  test("take Hathor Network's decimals when they have no more digits", () => {
    expect(nextAmountForDisplay(12000000000n, 2)).toEqual({ amount: 12000n, decimalPlaces: 2 });
    expect(nextAmountForDisplay(12345678n, 2)).toEqual({ amount: 12345678n, decimalPlaces: 8 });
  });

  test('drop the digits Hathor Network can\'t hold, never rounding up', () => {
    expect(nextToHathorAmount(12999999n, 2)).toBe(12n);
  });
});
