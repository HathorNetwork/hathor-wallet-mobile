/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { CHAIN } from '../../src/multichain/chains';
import { nextAmountForDisplay, nextToHathorAmount } from '../../src/multichain/amount';
import { combinedTokenList, nextTokenList } from '../../src/multichain/tokens';
import { TRANSFER_STATUS } from '../../src/multichain/state';

const HTR = { uid: '00', name: 'Hathor', symbol: 'HTR' };
const MY_TOKEN = { uid: 'a1', name: 'My Token', symbol: 'MTK' };
const NEXT_TST_A = { id: 'b1', name: 'Test Token', symbol: 'TST', lastActivityAt: 2 };
const NEXT_TST_B = { id: 'b2', name: 'Test Token', symbol: 'TST', lastActivityAt: 1 };
// A Hathor Next token named like a Hathor Network one: a different token all the same.
const NEXT_MTK = { id: 'b3', name: 'My Token', symbol: 'MTK', lastActivityAt: 3 };

const ready = (available) => ({ status: 'ready', data: { available } });

const NEXT_TOKENS = {
  '00': { id: '00', name: 'Hathor', symbol: 'HTR', lastActivityAt: 5 },
  b1: NEXT_TST_A,
  b2: NEXT_TST_B,
  b3: NEXT_MTK,
};

const list = ({
  transfers = [],
  nextHtr = 2500000000n,
  nextTokens = NEXT_TOKENS,
} = {}) => combinedTokenList({
  hathorTokens: { '00': HTR, a1: MY_TOKEN },
  hathorBalances: { '00': ready(9500n), a1: ready(1000n) },
  hathorDecimalPlaces: 2,
  nextTokens,
  nextBalances: {
    '00': ready(nextHtr),
    b1: ready(500000000n),
    b2: ready(100000000n),
    b3: ready(1234567n),
  },
  tokenMap: [{ hathor: '00', next: '00' }],
  // The pinned scale of a side chain: 1.00 HTR is 1.00000000 on Hathor Next.
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

  test("shows every Hathor Next token's id, so one named after HTR is told apart", () => {
    // Anyone can create a token called Hathor, HTR, and send it to any wallet.
    const rows = list({
      nextTokens: {
        ...NEXT_TOKENS,
        c9look: { id: 'c9look', name: 'Hathor', symbol: 'HTR', lastActivityAt: 1 },
      },
    });
    const htr = rows.filter((row) => row.symbol === 'HTR');
    expect(htr.map((row) => [row.name, row.chains])).toEqual([
      ['Hathor', [CHAIN.HATHOR, CHAIN.HATHOR_NEXT]],
      ['Hathor · c9look', [CHAIN.HATHOR_NEXT]],
    ]);
    // A token whose symbol no other shares carries its id too.
    expect(rows.find((row) => row.uid === 'next:b3').name).toMatch(/ · b3$/);
  });

  test("marks HTR and Hathor Next's native token native, and no token named after them", () => {
    // testnet-alpha: USDT is native there, and a transfer mints HTR as a token of its own.
    const rows = combinedTokenList({
      hathorTokens: { '00': HTR, a1: MY_TOKEN },
      hathorBalances: { '00': ready(100n), a1: ready(100n) },
      hathorDecimalPlaces: 2,
      nextTokens: {
        usdt: { id: 'usdt', name: 'US Dollar Tether', symbol: 'USDT' },
        nhtr: { id: 'nhtr', name: 'Hathor', symbol: 'HTR' },
        c9look: { id: 'c9look', name: 'Hathor', symbol: 'HTR', lastActivityAt: 9 },
        b1: NEXT_TST_A,
      },
      nextBalances: {},
      tokenMap: [{ hathor: '00', next: 'nhtr' }],
      mintScale: 1000000n,
      nativeTokenId: 'usdt',
      transfers: [],
    });
    expect(rows.map((row) => [row.uid, row.native])).toEqual([
      ['00', true],
      ['a1', false],
      ['next:usdt', true],
      ['next:c9look', false],
      ['next:b1', false],
    ]);
  });

  test('marks HTR native where the side chain carries nothing, its row Hathor Network\'s alone', () => {
    const rows = combinedTokenList({
      hathorTokens: { '00': HTR, a1: MY_TOKEN },
      hathorBalances: { '00': ready(100n), a1: ready(100n) },
      hathorDecimalPlaces: 2,
      nextTokens: { usdt: { id: 'usdt', name: 'US Dollar Tether', symbol: 'USDT' } },
      nextBalances: {},
      tokenMap: [],
      nativeTokenId: 'usdt',
      transfers: [],
    });
    expect(rows.map((row) => [row.uid, row.chains, row.native])).toEqual([
      ['00', [CHAIN.HATHOR], true],
      ['a1', [CHAIN.HATHOR], false],
      ['next:usdt', [CHAIN.HATHOR_NEXT], true],
    ]);
  });

  test("marks Hathor Next's native token and the HTR a transfer mints native in its own list", () => {
    const rows = nextTokenList({
      c9look: { id: 'c9look', name: 'Hathor', symbol: 'HTR', lastActivityAt: 9 },
      nhtr: { id: 'nhtr', name: 'Hathor', symbol: 'HTR' },
      usdt: { id: 'usdt', name: 'US Dollar Tether', symbol: 'USDT' },
    }, 'usdt', 'nhtr');
    expect(rows.map((row) => [row.uid, row.native, row.idTag])).toEqual([
      ['usdt', true, null],
      ['nhtr', true, null],
      ['c9look', false, 'c9look'],
    ]);
  });

  test('gives a list that cuts long names the id apart, and none to the native token', () => {
    const rows = list();
    expect(rows.find((row) => row.uid === 'next:b1')).toMatchObject({
      plainName: 'Test Token', idTag: 'b1',
    });
    expect(rows.find((row) => row.uid === '00')).toMatchObject({ plainName: 'Hathor', idTag: null });
    expect(rows.find((row) => row.uid === 'a1').idTag).toBeNull();
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
