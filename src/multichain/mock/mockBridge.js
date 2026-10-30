/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { getIntegerAmount } from '../../utils';
import { STORE } from '../../store';
import { withPasskeyWords } from '../../passkey/passkeySigner';
import { hathorToNextAmount } from '../amount';
import { canTransfer, CHAIN } from '../chains';
import { NextClientError, NEXT_CLIENT_ERROR } from '../nextClientErrors';
import { TRANSFER_STATUS } from '../state';
import { addTransfer, fakeTxId, ledgerTransfers, loadLedger } from './mockLedger';
import {
  BRIDGE_ETA_SECONDS,
  BRIDGE_FEE,
  BRIDGE_MIN_AMOUNT,
  BRIDGE_NETWORK_FEE,
  TRANSFER_DELAY_MS,
} from './mockValues';

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * A simulated bridge between Hathor Network and Hathor Next, with the interface of the real one
 * (src/multichain/bridge.js). It broadcasts nothing: Hathor Network's balance doesn't move, so its
 * records say so (`debitedOnSource: false`, no `sourceTxId`). A transfer to the wallet's own
 * Hathor Next address arrives in the simulated ledger after the arrival time; one to another
 * address leaves this wallet, so nothing arrives here.
 *
 * @param {Object} config The side chain config
 * @param {Object} options
 * @param {string} options.network The fullnode's network name
 * @param {number} options.decimalPlaces Hathor Network's decimal places
 */
export function createMockBridge(config, { network, decimalPlaces }) {
  const units = (amount) => getIntegerAmount(amount, decimalPlaces);
  let transferCount = 0;

  const requireDirection = (from, to) => {
    if (!canTransfer(config, from, to)) {
      throw new NextClientError(NEXT_CLIENT_ERROR.UNAVAILABLE);
    }
  };

  const nextTokenOf = (hathorTokenId) => (
    config.tokenMap.find((pair) => pair.hathor === hathorTokenId)?.next ?? null
  );

  const quote = ({ from = CHAIN.HATHOR, to = CHAIN.HATHOR_NEXT, amount, available }) => {
    requireDirection(from, to);
    const bridgeFee = units(BRIDGE_FEE);
    const networkFee = units(BRIDGE_NETWORK_FEE);
    const received = amount > bridgeFee ? amount - bridgeFee : 0n;
    const max = available > networkFee ? available - networkFee : 0n;
    return {
      bridgeFee,
      networkFee,
      receiveAmount: hathorToNextAmount(received, decimalPlaces),
      etaSeconds: BRIDGE_ETA_SECONDS,
      min: units(BRIDGE_MIN_AMOUNT),
      max,
    };
  };

  return {
    simulated: true,

    /** The tokens the bridge carries, by their id on each chain. */
    tokenMap: config.tokenMap,

    /** The ways it transfers: [{ from, to }]. */
    directions: config.directions,

    /**
     * What a transfer of `amount` costs and delivers. The bridge fee comes out of the amount;
     * the source chain's fee comes on top of it.
     *
     * @param {Object} params
     * @param {string} [params.from] One of CHAIN
     * @param {string} [params.to] One of CHAIN
     * @param {bigint} params.amount In the source chain's units
     * @param {bigint} params.available What the source chain has, in its units
     * @returns {{
     *   bridgeFee: bigint,
     *   networkFee: bigint,
     *   receiveAmount: bigint,
     *   etaSeconds: number,
     *   min: bigint,
     *   max: bigint,
     * }} receiveAmount is in the destination's units, the rest in the source's
     */
    quote,

    /**
     * @param {Object} params
     * @param {string} [params.from] One of CHAIN
     * @param {string} [params.to] One of CHAIN
     * @param {string} [params.tokenId] The token's id on the source chain
     * @param {bigint} params.amount In the source chain's units
     * @param {string} params.toAddress An address on the destination chain
     * @param {string|null} params.ownAddress The wallet's own address there, if known
     * @returns {Promise<Object>} The TransferRecord
     */
    async transfer({
      from = CHAIN.HATHOR,
      to = CHAIN.HATHOR_NEXT,
      tokenId = '00',
      amount,
      toAddress,
      ownAddress,
    }) {
      requireDirection(from, to);
      // A passkey wallet's Hathor Network send runs a passkey ceremony when the lib signs it. The
      // simulated transfer signs nothing, so it runs one here, for the flow to feel the same.
      if (STORE.isPasskeyWallet()) {
        await withPasskeyWords(async () => {});
      }
      await wait(TRANSFER_DELAY_MS);
      transferCount += 1;
      const sentAt = Date.now();
      const { bridgeFee, networkFee, receiveAmount } = quote({
        from, to, amount, available: amount,
      });
      const record = {
        id: fakeTxId((sentAt + transferCount) % 2147483647),
        from,
        to,
        hathorTokenId: tokenId,
        nextTokenId: nextTokenOf(tokenId),
        amount: amount.toString(),
        receiveAmount: receiveAmount.toString(),
        bridgeFee: bridgeFee.toString(),
        networkFee: networkFee.toString(),
        toAddress,
        toOwn: Boolean(ownAddress) && toAddress === ownAddress,
        sentAt,
        arriveAt: sentAt + BRIDGE_ETA_SECONDS * 1000,
        status: TRANSFER_STATUS.PENDING,
        sourceTxId: null,
        debitedOnSource: false,
      };
      addTransfer(network, record);
      return record;
    },

    /** @returns {Object[]} The transfers, newest first */
    getTransfers() {
      return ledgerTransfers(loadLedger(network));
    },
  };
}
