/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createMockBridge } from './mock/mockBridge';
import { NextClientError, NEXT_CLIENT_ERROR } from './nextClientErrors';

/**
 * The bridge between Hathor Network and Hathor Next. The real one is the lib team's; until then it
 * is simulated, with the same interface:
 * - tokenMap: [{ hathor, next }], the tokens it carries, by their id on each chain;
 * - directions: [{ from, to }], the ways it transfers (CHAIN values);
 * - quote({ from, to, amount, available }) → { bridgeFee, networkFee, receiveAmount, etaSeconds,
 *   min, max }: amounts in the source chain's units, except receiveAmount, in the destination's;
 * - transfer({ from, to, tokenId, amount, toAddress, ownAddress, pinCode }) → TransferRecord;
 * - getTransfers() → TransferRecord[], newest first.
 *
 * A TransferRecord is one transfer, made of a transaction on each chain:
 * { id, from, to, hathorTokenId, nextTokenId, amount, receiveAmount, bridgeFee, networkFee,
 *   toAddress, toOwn, sentAt, arriveAt, status, sourceTxId, debitedOnSource }. Amounts are strings
 * in base units: amount and the fees in the source chain's, receiveAmount in the destination's.
 * toOwn says the address is the wallet's own, so the transfer arrives here. status is 'pending'
 * or 'arrived' (TRANSFER_STATUS). sourceTxId is the source chain's transaction, which the screens
 * show as the transfer's row; debitedOnSource says the source balance already moved, so a combined
 * total counts the transfer while it is on its way.
 *
 * @param {Object} config The side chain config (src/multichain/chains.js)
 * @param {{ network: string, decimalPlaces: number }} options
 * @returns {Object}
 */
export function createBridge(config, options) {
  if (config.simulated) {
    return createMockBridge(config, options);
  }
  throw new NextClientError(NEXT_CLIENT_ERROR.UNAVAILABLE);
}
