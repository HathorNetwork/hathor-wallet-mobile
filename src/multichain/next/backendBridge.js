/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TxNotFoundError } from '@hathor/wallet-lib/lib/errors';
import { logger } from '../../logger';
import { nextAddressError, normalizeNextAddress, sameNextAddress } from '../address';
import { mintScaleOf } from '../amount';
import { CHAIN, mintedTokenId } from '../chains';
import { NEXT_CLIENT_ERROR, NextClientError } from '../nextClientErrors';
import { TRANSFER_STATUS } from '../state';
import {
  BURN_DATA_VALUE,
  checkBurn,
  dataScriptPayload,
  inputDataOf,
  parseBurnPayload,
} from './burnCheck';
import { encodeAddress } from './kit/address';
import { SignRefusedError } from './signer';
import { BackendError } from './backendApi';

const log = logger('multichain-backend-bridge');

/**
 * The bridge to Hathor Next through the Hathor Next backend: Hathor Network's HTR moves to an
 * address on Hathor Next by a burn the backend builds and this wallet checks (burnCheck.js) and
 * signs with its own Hathor Network keys. The minted HTR arrives at the address the burn names,
 * this wallet's own or anyone's, as the token the network mints for it (its native token, or a
 * token of its own), at the network's pinned scale.
 * Its interface is the bridge's (bridge.js).
 */

const NATIVE_HTR = '00';
// Without the network's own figure, a block every 30 seconds, hathor-core testnet's pace.
const DEFAULT_BLOCK_MS = 30000;
// The most inputs the backend takes in one burn.
const MAX_TRANSFER_INPUTS = 255;
// Backend states of a burn that never reached the network: nothing left the wallet.
const NEVER_SENT = new Set(['awaiting_signatures', 'cancelled']);

// The wallet's own reads of burns, per wallet, kept across the bridges the app makes: a burn on
// the chain doesn't change, and each refresh makes a bridge of its own. By the wallet, as whether
// a burn spends its outputs is that wallet's answer.
const burnReads = new WeakMap();

/**
 * @param {Object} wallet
 * @returns {Map<string, Object|null>}
 */
function burnReadsOf(wallet) {
  if (!burnReads.has(wallet)) {
    burnReads.set(wallet, new Map());
  }
  return burnReads.get(wallet);
}

/**
 * A transfer as the screens show it, from the backend's status of its burn. A burn that never
 * reached the network (awaiting its signatures, or cancelled) is no transfer: null.
 *
 * Only what this wallet saw for itself makes a transfer stand for one of its Hathor Network
 * transactions (sourceTxId, which hides that transaction's own row) and count as gone from its
 * balance (debitedOnSource): the burn this app checked before signing it, or the wallet's own copy
 * of the burn, read from its Hathor Network node (ownBurn). Its amount and destination are then
 * those, never the backend's.
 *
 * @param {Object} status The backend's TransferStatus
 * @param {Object} config The side chain config
 * @param {string|null} ownAddress
 * @param {{ burnTxId?: string, amount?: string, destination?: string }|null} [own] What this
 *   wallet saw of the burn
 * @returns {Object|null} TransferRecord
 * @throws When the status can't be read: no state, or an amount that isn't one
 */
export function recordOf(status, config, ownAddress, own = null) {
  if (typeof status?.status !== 'string') {
    throw new Error('A transfer status without its state.');
  }
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
  // One on its way arrives once the blocks it still waits for are mined. The backend reports no
  // time for one that arrived, so the time its burn's confirmations take from when it was sent
  // stands in: a time that stays put, so the transfer keeps its place in the history.
  const arriveAt = state === TRANSFER_STATUS.ARRIVED
    ? sentAt + needed * blockMs
    : Date.now() + left * blockMs;
  // Where the burn goes, as this wallet saw it, or else as the backend reports it. Unknown, it is
  // never taken for this wallet's own address: someone else's HTR would count as arriving here.
  const toAddress = own?.destination ?? status.destination ?? null;
  const amount = own?.amount ?? status.amount;
  if (typeof amount !== 'string' || !/^[0-9]+$/.test(amount)) {
    throw new Error('A transfer status without a readable amount.');
  }
  return {
    id: status.id,
    from: CHAIN.HATHOR,
    to: CHAIN.HATHOR_NEXT,
    hathorTokenId: NATIVE_HTR,
    nextTokenId: mintedTokenId(config),
    amount,
    receiveAmount: (BigInt(amount) * mintScaleOf(config)).toString(),
    bridgeFee: '0',
    networkFee: BURN_DATA_VALUE.toString(),
    toAddress,
    toOwn: sameNextAddress(toAddress, ownAddress),
    sentAt,
    arriveAt,
    // How long a transfer usually takes: its burn's confirmations, at the network's pace.
    usualMs: needed * blockMs,
    status: state,
    sourceTxId: own?.burnTxId ?? null,
    // A failed burn never left the balance; any other this wallet saw for itself did.
    debitedOnSource: Boolean(own?.burnTxId) && !failed,
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

  // The wallet's own copies of burns, read once each, for this transfer address and destination.
  // The screens make a bridge without a wallet, only for its quote and directions: it reads no
  // burn.
  const reads = wallet ? burnReadsOf(wallet) : new Map();
  const readKey = (burnTxId) => `${pins?.transfer_address}:${pins?.destination_network}:${burnTxId}`;

  /**
   * The wallet's own copy of a burn, from its Hathor Network node, not from the backend: whether
   * it spends this wallet's outputs, what it paid the pinned transfer address, and where its data
   * output says the HTR arrives. Null when it is no burn of this wallet's to that address.
   *
   * @param {string} burnTxId
   * @returns {Promise<{ burnTxId: string, amount: string, destination: string }|null>}
   * @throws When the node can't be read
   */
  const readOwnBurn = async (burnTxId) => {
    if (typeof burnTxId !== 'string' || !/^[0-9a-f]{64}$/.test(burnTxId)) {
      return null;
    }
    if (reads.has(readKey(burnTxId))) {
      return reads.get(readKey(burnTxId));
    }
    const { tx } = await wallet.getFullTxById(burnTxId);
    const outputs = Array.isArray(tx?.outputs) ? tx.outputs : [];
    const paid = outputs.find((o) => Number(o.token_data) === 0
      && o.decoded?.address === pins?.transfer_address);
    const payload = outputs.map((o) => {
      try {
        return parseBurnPayload(dataScriptPayload(Buffer.from(o.script, 'base64')));
      } catch (e) {
        return null;
      }
    }).find(Boolean);
    const spender = tx?.inputs?.[0]?.decoded?.address;
    const mine = typeof spender === 'string' && await wallet.isAddressMine(spender);
    const found = paid && payload && mine && payload.destinationNetwork === pins.destination_network
      ? {
        burnTxId,
        amount: String(paid.value),
        destination: encodeAddress(payload.view, payload.spend),
      }
      : null;
    reads.set(readKey(burnTxId), found);
    return found;
  };

  /**
   * As readOwnBurn, null when the node can't be read yet: it is read again next time.
   *
   * @param {string} burnTxId
   */
  const ownBurn = async (burnTxId) => {
    try {
      return await readOwnBurn(burnTxId);
    } catch (e) {
      log.error('Could not read a transfer\'s burn from Hathor Network.', e);
      return null;
    }
  };

  /**
   * Whether the backend no longer knows a transfer its read answered 404 for. A 404 alone doesn't
   * say so: the backend answers it too while transfers aren't configured, and a proxy can answer
   * it during a deploy, while the backend still keeps the signed burn and pushes it later. The
   * backend's list of this wallet's transfers, read without it, does: the backend keeps every
   * transfer it took, with no expiry.
   *
   * @param {string} transferId
   * @returns {Promise<boolean>}
   * @throws When the list can't be read: whether the backend knows it is still unknown
   */
  const backendForgot = async (transferId) => {
    const listed = await client.getTransfers();
    return !listed.some((status) => status?.id === transferId);
  };

  /**
   * A transfer the backend no longer knows (a reset devnet, a record it dropped), settled by what
   * the wallet's own node says of the outputs its burn spends: none spent, or spent by anything
   * but this wallet's burn, and nothing left the wallet. A burn that did reach the network, a
   * transfer saved without its outputs, or one whose outputs the node doesn't have (Hathor
   * Network was reset too) has nobody left to finish it: it ends as forgotten.
   *
   * @param {{ txId: string, index: number }[]|undefined} inputs
   * @returns {Promise<null>} null: it never went through
   * @throws {NextClientError} TRANSFER_FORGOTTEN; or when the node can't be read
   */
  const settleForgotten = async (inputs) => {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN);
    }
    for (const { txId, index } of inputs) {
      let meta;
      try {
        // eslint-disable-next-line no-await-in-loop
        ({ meta } = await wallet.getFullTxById(txId));
      } catch (e) {
        if (e instanceof TxNotFoundError) {
          throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN);
        }
        throw e;
      }
      // Without the list of what spent its outputs, the node says nothing of them: read again.
      if (!Array.isArray(meta?.spent_outputs)) {
        throw new Error('The node gave an output\'s transaction without what spent it.');
      }
      const spenders = meta.spent_outputs
        .filter(([output]) => output === index)
        .flatMap(([, ids]) => ids);
      for (const spender of spenders) {
        // eslint-disable-next-line no-await-in-loop
        if (await readOwnBurn(spender)) {
          throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN);
        }
      }
    }
    return null;
  };

  return {
    tokenMap: [{ hathor: NATIVE_HTR, next: mintedTokenId(config) }],
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
      // Only the canonical form, with its checksum, and never a key nobody can spend from.
      const destination = nextAddressError(toAddress) ? null : normalizeNextAddress(toAddress);
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
      // Signed: from here on, nothing ends as a plain failure, which would let the user burn
      // again. Anything that goes wrong leaves the transfer uncertain, to be settled by asking,
      // or by the outputs it spends if the backend no longer knows it.
      const uncertain = {
        transferId: request.id,
        inputs: chosen.map(({ txId, index }) => ({ txId, index })),
      };
      let record;
      try {
        if (changeAddress && (await wallet.getCurrentAddress()).address === changeAddress) {
          await wallet.getCurrentAddress({ markAsUsed: true });
        }
        const status = await client.signTransfer(request.id, inputDataOf(signed));
        // The burn this app checked stands for the transfer: the destination chosen, the amount
        // moved. Its id is the backend's word until the wallet's own copy shows it.
        const seen = await ownBurn(status?.burn_tx_id);
        record = recordOf(status, config, ownAddress, {
          burnTxId: seen?.burnTxId,
          amount: amount.toString(),
          destination,
        });
      } catch (e) {
        log.error('A signed transfer got no answer the app could read.', e);
        throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN, uncertain);
      }
      if (!record) {
        throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN, uncertain);
      }
      return record;
    },

    /**
     * Settles a transfer signed without an answer: its record when the burn reached the network;
     * null when it never did, after cancelling it on the backend, so nothing is left behind and
     * a new transfer can't burn twice. One the backend no longer knows (backendForgot) is settled
     * by the outputs its burn spends (settleForgotten).
     *
     * @param {string} transferId
     * @param {{ inputs?: { txId: string, index: number }[] }} [saved] The outputs its burn spends
     * @returns {Promise<Object|null>} TransferRecord
     * @throws When the backend or the node can't be read: still uncertain; TRANSFER_FORGOTTEN
     */
    async resolveTransfer(transferId, { inputs } = {}) {
      let status;
      try {
        status = await client.getTransfer(transferId);
      } catch (e) {
        if (e instanceof BackendError && e.status === 404 && await backendForgot(transferId)) {
          return settleForgotten(inputs);
        }
        throw e;
      }
      if (status?.status === 'awaiting_signatures') {
        await client.cancelTransfer(transferId);
        // Cancelled, unless the signatures arrived meanwhile: read it once more.
        status = await client.getTransfer(transferId);
      }
      return recordOf(status, config, client.getAddress(), await ownBurn(status?.burn_tx_id));
    },

    /** @returns {Promise<Object[]>} TransferRecords, newest first */
    async getTransfers() {
      if (!pins || !client.getNetwork()) {
        return [];
      }
      const ownAddress = client.getAddress();
      // One burn is one transfer: listed again under another id, it would count twice.
      const burns = new Set();
      const list = (await client.getTransfers()).filter((status) => {
        const burnTxId = status?.burn_tx_id;
        if (typeof burnTxId !== 'string') {
          return true;
        }
        if (burns.has(burnTxId)) {
          log.error('The backend lists one burn as two transfers; the second was left out.');
          return false;
        }
        burns.add(burnTxId);
        return true;
      });
      // A transfer the app can't read is left out, and logged: the others still show.
      const records = await Promise.all(list.map(async (status) => {
        try {
          return recordOf(status, config, ownAddress, await ownBurn(status?.burn_tx_id));
        } catch (e) {
          log.error('A transfer from the backend could not be read; it was left out.', e);
          return null;
        }
      }));
      return records
        .filter(Boolean)
        .sort((a, b) => b.sentAt - a.sentAt);
    },
  };
}
