/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { logger } from '../../logger';
import { normalizeNextAddress, sameNextAddress } from '../address';
import { mintScaleOf } from '../amount';
import { CHAIN } from '../chains';
import { NEXT_CLIENT_ERROR, NextClientError } from '../nextClientErrors';
import { TRANSFER_STATUS } from '../state';
import { BURN_DATA_VALUE, checkBurn, inputDataOf } from './burnCheck';
import { SignRefusedError } from './signer';

const log = logger('multichain-backend-bridge');

/**
 * The bridge to Hathor Next through the Hathor Next backend: Hathor Network's HTR moves to an
 * address on Hathor Next by a burn the backend builds and this wallet checks (burnCheck.js) and
 * signs with its own Hathor Network keys. The minted HTR arrives at the address the burn names,
 * this wallet's own or anyone's, as Hathor Next's native token, at the network's pinned scale.
 * Same interface as the simulated bridge (bridge.js).
 */

const NATIVE_HTR = '00';
// Without the network's own figure, a block every 30 seconds, hathor-core testnet's pace.
const DEFAULT_BLOCK_MS = 30000;
// The most inputs the backend takes in one burn.
const MAX_TRANSFER_INPUTS = 255;
// Backend states of a burn that never reached the network: nothing left the wallet.
const NEVER_SENT = new Set(['awaiting_signatures', 'cancelled']);

/**
 * A transfer as the screens show it, from the backend's status of its burn. A burn that never
 * reached the network (awaiting its signatures, or cancelled) is no transfer: null.
 *
 * @param {Object} status The backend's TransferStatus
 * @param {Object} config The side chain config
 * @param {string|null} ownAddress
 * @returns {Object|null} TransferRecord
 */
export function recordOf(status, config, ownAddress) {
  if (NEVER_SENT.has(status.status)) {
    return null;
  }
  const sentAt = (status.created_at ?? 0) * 1000;
  const blockMs = config.transfer?.mean_block_ms ?? DEFAULT_BLOCK_MS;
  const needed = status.needed ?? config.transfer?.confirmations ?? 0;
  const left = Math.max(needed - (status.confirmations ?? 0), 0);
  const failed = status.status === 'failed';
  let state = TRANSFER_STATUS.PENDING;
  if (status.status === 'arrived') state = TRANSFER_STATUS.ARRIVED;
  if (failed) state = TRANSFER_STATUS.FAILED;
  // A backend that doesn't say where a burn goes only ever named this wallet's own address.
  const toAddress = status.destination ?? ownAddress;
  return {
    id: status.id,
    from: CHAIN.HATHOR,
    to: CHAIN.HATHOR_NEXT,
    hathorTokenId: NATIVE_HTR,
    nextTokenId: config.nativeTokenId,
    amount: status.amount,
    receiveAmount: (BigInt(status.amount) * mintScaleOf(config)).toString(),
    bridgeFee: '0',
    networkFee: BURN_DATA_VALUE.toString(),
    toAddress,
    toOwn: Boolean(ownAddress) && sameNextAddress(toAddress, ownAddress),
    sentAt,
    arriveAt: Date.now() + left * blockMs,
    status: state,
    sourceTxId: status.burn_tx_id ?? null,
    // A failed burn never left the balance; any other the backend pushed did.
    debitedOnSource: Boolean(status.burn_tx_id) && !failed,
    reason: status.reason ?? null,
    progress: {
      stage: status.status,
      confirmations: status.confirmations ?? 0,
      needed,
      mintTxId: status.mint_tx_id ?? null,
    },
  };
}

/**
 * @param {Object} config The side chain config, with its pinned `transfer` values
 * @param {Object} options
 * @param {Object} options.wallet The running Hathor Network wallet (wallet-lib)
 * @param {Object} options.network wallet-lib's Network of that wallet
 * @param {Object} options.client The Hathor Next backend client
 * @returns {Object}
 */
export function createBackendBridge(config, { wallet, network, client }) {
  const pins = config.transfer;
  const scale = mintScaleOf(config);
  const requireTransfer = (from, to) => {
    if (!pins || from !== CHAIN.HATHOR || to !== CHAIN.HATHOR_NEXT) {
      throw new NextClientError(NEXT_CLIENT_ERROR.UNAVAILABLE);
    }
  };
  const cancel = (transferId) => client.cancelTransfer(transferId).catch((e) => {
    log.error('Could not cancel an unsigned transfer.', e);
  });

  return {
    tokenMap: [{ hathor: NATIVE_HTR, next: config.nativeTokenId }],
    directions: config.directions,

    /**
     * What a transfer costs and gives. The burn's data output keeps one base unit of HTR, and
     * the HTR arrives at the network's pinned scale.
     */
    quote({ amount, available }) {
      const blockMs = pins?.mean_block_ms ?? DEFAULT_BLOCK_MS;
      return {
        bridgeFee: 0n,
        networkFee: BURN_DATA_VALUE,
        receiveAmount: amount * scale,
        etaSeconds: Math.ceil(((pins?.confirmations ?? 0) * blockMs) / 1000),
        min: 1n,
        max: available > BURN_DATA_VALUE ? available - BURN_DATA_VALUE : 0n,
      };
    },

    /**
     * Moves HTR from Hathor Network to an address on Hathor Next: this wallet's own or anyone's.
     * The burn names the address, and a wrong one loses the HTR for good, so the burn is checked
     * against the address the user chose, never against what the backend says.
     *
     * A burn refused before signing is cancelled on the backend. Once signed, a failure to hear
     * back is not a failure: it throws TRANSFER_UNCERTAIN with the transfer's id, for
     * resolveTransfer to settle before anything is tried again.
     *
     * @returns {Promise<Object>} TransferRecord
     */
    async transfer({ from, to, tokenId, amount, toAddress, ownAddress, pinCode }) {
      requireTransfer(from, to);
      if (tokenId !== NATIVE_HTR) {
        throw new NextClientError(NEXT_CLIENT_ERROR.UNAVAILABLE);
      }
      const destination = normalizeNextAddress(toAddress);
      if (!destination) {
        throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_BAD_ADDRESS);
      }
      const { utxos, changeAmount } = await wallet.getUtxosForAmount(
        amount + BURN_DATA_VALUE,
        { token: NATIVE_HTR },
      );
      if (utxos.length > MAX_TRANSFER_INPUTS) {
        throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_TOO_MANY_INPUTS);
      }
      // The change address is marked used only once the burn is signed: a refusal keeps it.
      const changeAddress = changeAmount > 0n
        ? (await wallet.getCurrentAddress()).address
        : null;
      const chosen = utxos.map((u) => ({ txId: u.txId, index: u.index, value: BigInt(u.value) }));
      const request = await client.createTransfer({
        amount,
        utxos: chosen,
        changeAddress,
        destination,
      });
      let signed;
      try {
        const tx = checkBurn(request.unsigned_tx, {
          network,
          utxos: chosen,
          amount,
          transferAddress: pins.transfer_address,
          changeAddress,
          destinationNetwork: pins.destination_network,
          destination,
        });
        signed = await wallet.signTx(tx, { pinCode });
      } catch (e) {
        cancel(request.id);
        if (e instanceof SignRefusedError) {
          log.error(`A transfer was refused before signing: ${e.message}`);
          throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_REFUSED);
        }
        throw e;
      }
      if (changeAddress && (await wallet.getCurrentAddress()).address === changeAddress) {
        await wallet.getCurrentAddress({ markAsUsed: true });
      }
      let status;
      try {
        status = await client.signTransfer(request.id, inputDataOf(signed));
      } catch (e) {
        log.error('A signed transfer got no answer from the backend.', e);
        throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN, { transferId: request.id });
      }
      const record = recordOf(status, config, ownAddress);
      if (!record) {
        throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN, { transferId: request.id });
      }
      return record;
    },

    /**
     * Settles a transfer signed without an answer: its record when the burn reached the network;
     * null when it never did, after cancelling it on the backend, so nothing is left behind and
     * a new transfer can't burn twice.
     *
     * @param {string} transferId
     * @returns {Promise<Object|null>} TransferRecord
     * @throws When the backend can't be read: still uncertain
     */
    async resolveTransfer(transferId) {
      const status = await client.getTransfer(transferId);
      if (status.status === 'awaiting_signatures') {
        await client.cancelTransfer(transferId);
        // Cancelled, unless the signatures arrived meanwhile: read it once more.
        return recordOf(await client.getTransfer(transferId), config, client.getAddress());
      }
      return recordOf(status, config, client.getAddress());
    },

    /** @returns {Promise<Object[]>} TransferRecords, newest first */
    async getTransfers() {
      if (!pins || !client.getNetwork()) {
        return [];
      }
      const ownAddress = client.getAddress();
      const list = await client.getTransfers();
      return list
        .map((status) => recordOf(status, config, ownAddress))
        .filter(Boolean)
        .sort((a, b) => b.sentAt - a.sentAt);
    },
  };
}
