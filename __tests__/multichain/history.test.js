/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { CHAIN } from '../../src/multichain/chains';
import { HISTORY_ROW, HISTORY_VIEW, tokenHistory } from '../../src/multichain/history';
import { TRANSFER_STATUS } from '../../src/multichain/state';

const ids = { hathor: '00', next: '00' };
// Hathor Network times are in seconds, Hathor Next's in milliseconds.
const hathorTx = (txId, seconds) => ({ txId, timestamp: seconds });
const nextRow = (id, ms, fields = {}) => ({ id, at: ms, ...fields });
const transfer = (fields = {}) => ({
  id: 'transfer-1',
  from: CHAIN.HATHOR,
  to: CHAIN.HATHOR_NEXT,
  hathorTokenId: '00',
  nextTokenId: '00',
  toOwn: true,
  sentAt: 50000,
  arriveAt: 170000,
  status: TRANSFER_STATUS.ARRIVED,
  sourceTxId: null,
  ...fields,
});

const history = (view, fields = {}) => tokenHistory({
  view,
  ids,
  hathorTxs: [hathorTx('h2', 90), hathorTx('h1', 10)],
  hathorHasMore: false,
  nextRows: [nextRow('n2', 100000), nextRow('n1', 20000)],
  nextHasMore: false,
  transfers: [transfer()],
  ...fields,
});

describe("a token's history on both chains", () => {
  test('mixes both chains newest first, a transfer as one row', () => {
    expect(history(HISTORY_VIEW.ALL).map((row) => row.key)).toEqual([
      'next:n2', 'hathor:h2', 'transfer:transfer-1', 'next:n1', 'hathor:h1',
    ]);
    const row = history(HISTORY_VIEW.ALL).find((r) => r.kind === HISTORY_ROW.TRANSFER);
    expect(row.chain).toBe(CHAIN.HATHOR);
  });

  test("shows one chain's rows, and a transfer as its side there", () => {
    const hathor = history(HISTORY_VIEW.HATHOR);
    expect(hathor.map((row) => row.key)).toEqual([
      'hathor:h2', 'transfer:transfer-1', 'hathor:h1',
    ]);
    expect(hathor[1].kind).toBe(HISTORY_ROW.TRANSFER_SOURCE);

    const next = history(HISTORY_VIEW.HATHOR_NEXT);
    expect(next.map((row) => row.key)).toEqual(['transfer:transfer-1', 'next:n2', 'next:n1']);
    expect(next[0]).toMatchObject({ kind: HISTORY_ROW.TRANSFER_DESTINATION, time: 170000 });
  });

  test('keeps a transfer to another address off the chain it went to', () => {
    const next = history(HISTORY_VIEW.HATHOR_NEXT, { transfers: [transfer({ toOwn: false })] });
    expect(next.map((row) => row.key)).toEqual(['next:n2', 'next:n1']);
  });

  test("hides a transfer's own transactions behind its row", () => {
    const rows = history(HISTORY_VIEW.ALL, {
      transfers: [transfer({ sourceTxId: 'h2' })],
      nextRows: [nextRow('n2', 100000, { transferId: 'transfer-1' }), nextRow('n1', 20000)],
    });
    expect(rows.map((row) => row.key)).toEqual(['transfer:transfer-1', 'next:n1', 'hathor:h1']);
  });

  test('hides the mint a transfer arrived in, by its transaction', () => {
    const rows = history(HISTORY_VIEW.HATHOR_NEXT, {
      transfers: [transfer({ progress: { stage: 'arrived', mintTxId: 'mint-tx' } })],
      nextRows: [
        nextRow('n2', 100000, { kind: 'mint', txId: 'mint-tx', transferId: null }),
        nextRow('n1', 20000, { kind: 'mint', txId: 'other-mint' }),
      ],
    });
    expect(rows.map((row) => row.key)).toEqual(['transfer:transfer-1', 'next:n1']);
  });

  test('holds back rows older than what a chain with more pages has loaded', () => {
    const rows = history(HISTORY_VIEW.ALL, { hathorHasMore: true, hathorTxs: [hathorTx('h2', 90)] });
    // Hathor Network may still have rows between 90 s and now: nothing older shows yet.
    expect(rows.map((row) => row.key)).toEqual(['next:n2', 'hathor:h2']);
  });

  test("leaves out a token's other chain when it has none", () => {
    const rows = tokenHistory({
      view: HISTORY_VIEW.ALL,
      ids: { hathor: null, next: 'b1' },
      hathorTxs: [hathorTx('h1', 10)],
      hathorHasMore: false,
      nextRows: [nextRow('n1', 20000)],
      nextHasMore: false,
      transfers: [transfer()],
    });
    expect(rows.map((row) => row.key)).toEqual(['next:n1']);
  });
});
