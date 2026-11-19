/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CHAIN } from './chains';
import { TRANSFER_STATUS } from './state';

/**
 * Which history a token screen shows: all chains, or one.
 */
export const HISTORY_VIEW = {
  ALL: 'all',
  HATHOR: CHAIN.HATHOR,
  HATHOR_NEXT: CHAIN.HATHOR_NEXT,
};

/**
 * The kinds of rows a token's history holds.
 * - HATHOR: a Hathor Network transaction (wallet-lib's TxHistory);
 * - NEXT: a Hathor Next row (Samba's Tx shape, the client's getHistory rows);
 * - TRANSFER: a transfer between chains, as one row (all chains);
 * - TRANSFER_SOURCE / TRANSFER_DESTINATION: its side on one chain.
 */
export const HISTORY_ROW = {
  HATHOR: 'hathor',
  NEXT: 'next',
  TRANSFER: 'transfer',
  TRANSFER_SOURCE: 'transfer-source',
  TRANSFER_DESTINATION: 'transfer-destination',
};

/**
 * Whether a transfer moves a token: its id on the chain it left or on the one it went to.
 *
 * @param {Object} transfer TransferRecord (src/multichain/bridge.js)
 * @param {{ hathor: string|null, next: string|null }} ids
 * @returns {boolean}
 */
const movesToken = (transfer, ids) => (
  (ids.hathor !== null && transfer.hathorTokenId === ids.hathor)
  || (ids.next !== null && transfer.nextTokenId === ids.next)
);

/**
 * When a transfer shows on a chain: when it left, on the chain it left, and when it arrived (or
 * left, while it is on its way) on the chain it went to.
 *
 * @param {Object} transfer
 * @param {string} kind One of HISTORY_ROW
 * @returns {number} Unix ms
 */
const transferTime = (transfer, kind) => (
  kind === HISTORY_ROW.TRANSFER_DESTINATION && transfer.status === TRANSFER_STATUS.ARRIVED
    ? transfer.arriveAt
    : transfer.sentAt
);

/**
 * A token's history, newest first: Hathor Network's transactions, Hathor Next's rows and the
 * transfers between chains.
 *
 * - All chains: every row, and a transfer as one row.
 * - One chain: that chain's rows, and each transfer as its side on that chain. On the chain it
 *   went to, only a transfer to the wallet's own address shows: one to another address never
 *   arrives here.
 *
 * A transfer's own transactions are hidden, since its row stands for them: the Hathor Network
 * transaction it was sent in (`sourceTxId`), and the Hathor Next row it arrived in (the row's
 * `transferId`, or the mint's transaction, `progress.mintTxId`).
 *
 * Each chain's history loads in pages. Rows older than the oldest row loaded from a chain that
 * has more pages are left out until that chain's next page loads, so no row shows out of order.
 *
 * @param {Object} params
 * @param {string} params.view One of HISTORY_VIEW
 * @param {{ hathor: string|null, next: string|null }} params.ids The token's id on each chain
 * @param {Object[]} params.hathorTxs Loaded Hathor Network transactions, newest first
 * @param {boolean} params.hathorHasMore
 * @param {Object[]} params.nextRows Loaded Hathor Next rows, newest first
 * @param {boolean} params.nextHasMore
 * @param {Object[]} params.transfers TransferRecord
 * @returns {{ key: string, kind: string, time: number, chain: string, data: Object }[]}
 */
export function tokenHistory({
  view,
  ids,
  hathorTxs,
  hathorHasMore,
  nextRows,
  nextHasMore,
  transfers,
}) {
  const showHathor = view !== HISTORY_VIEW.HATHOR_NEXT && ids.hathor !== null;
  const showNext = view !== HISTORY_VIEW.HATHOR && ids.next !== null;
  const ownTransfers = transfers.filter((transfer) => movesToken(transfer, ids));
  const sourceTxIds = new Set(ownTransfers.map((transfer) => transfer.sourceTxId).filter(Boolean));
  const transferIds = new Set(ownTransfers.map((transfer) => transfer.id));
  const mintTxIds = new Set(ownTransfers.map((t) => t.progress?.mintTxId).filter(Boolean));

  const rows = [];
  if (showHathor) {
    for (const tx of hathorTxs) {
      if (!sourceTxIds.has(tx.txId)) {
        rows.push({
          key: `hathor:${tx.txId}`,
          kind: HISTORY_ROW.HATHOR,
          time: tx.timestamp * 1000,
          chain: CHAIN.HATHOR,
          data: tx,
        });
      }
    }
  }
  if (showNext) {
    for (const row of nextRows) {
      const isTransfers = (row.transferId && transferIds.has(row.transferId))
        || (row.txId && mintTxIds.has(row.txId));
      if (!isTransfers) {
        rows.push({
          key: `next:${row.id}`,
          kind: HISTORY_ROW.NEXT,
          time: row.at,
          chain: CHAIN.HATHOR_NEXT,
          data: row,
        });
      }
    }
  }
  for (const transfer of ownTransfers) {
    if (view === HISTORY_VIEW.ALL) {
      rows.push({
        key: `transfer:${transfer.id}`,
        kind: HISTORY_ROW.TRANSFER,
        time: transfer.sentAt,
        chain: transfer.from,
        data: transfer,
      });
    } else if (view === transfer.from) {
      rows.push({
        key: `transfer:${transfer.id}`,
        kind: HISTORY_ROW.TRANSFER_SOURCE,
        time: transferTime(transfer, HISTORY_ROW.TRANSFER_SOURCE),
        chain: transfer.from,
        data: transfer,
      });
    } else if (view === transfer.to && transfer.toOwn) {
      rows.push({
        key: `transfer:${transfer.id}`,
        kind: HISTORY_ROW.TRANSFER_DESTINATION,
        time: transferTime(transfer, HISTORY_ROW.TRANSFER_DESTINATION),
        chain: transfer.to,
        data: transfer,
      });
    }
  }

  // The oldest row loaded from each chain that has more pages: nothing older shows yet.
  const cutoffs = [];
  if (showHathor && hathorHasMore && hathorTxs.length) {
    cutoffs.push(hathorTxs[hathorTxs.length - 1].timestamp * 1000);
  }
  if (showNext && nextHasMore && nextRows.length) {
    cutoffs.push(nextRows[nextRows.length - 1].at);
  }
  const cutoff = cutoffs.length ? Math.max(...cutoffs) : -Infinity;

  return rows
    .filter((row) => row.time >= cutoff)
    .sort((a, b) => b.time - a.time);
}
