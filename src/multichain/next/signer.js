/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { decodeAddressKeys } from './kit/address';
import { EXCESS_DOMAIN, signInput, verifyIn } from './kit/inputSig';
import { publicKeyOf } from './kit/keys';
import { checkOpening } from './kit/opening';
import {
  bytesToBigintLE,
  bytesToHex,
  hexToBytes,
  modOrder,
  ORDER,
} from './kit/scalar';
import { TOKEN_INDEX_NATIVE } from './kit/txV2';
import {
  parseTx,
  signingHashOf,
  spentOutputs,
  spentOutputsOfBytes,
  txIdOf,
  withInputSignatures,
} from './kit/tx';

/**
 * Checks a transaction the Hathor Next backend built against what the user asked for, then signs
 * it. The backend never holds a key, so a signature is the one thing it needs from the app, and
 * one signature over the wrong transaction would move the money anyway: nothing is signed until
 * the transaction is shown, from its own bytes, to pay exactly the user's payment and change back
 * to this wallet. Then Hathor Next's sign-once rule: an input is never signed into two different
 * transactions.
 */

export class SignRefusedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SignRefusedError';
  }
}

/**
 * An input of the request was already signed into another transaction. That transaction may
 * still go through, so nothing new is signed; its saved bytes can be submitted again.
 */
export class LedgerConflictError extends SignRefusedError {
  /** @param {Object} entry The ledger entry of the earlier transaction */
  constructor(entry) {
    super('An input was already signed into another transaction.');
    this.name = 'LedgerConflictError';
    this.entry = entry;
  }
}

const refuse = (message) => {
  throw new SignRefusedError(message);
};

const sameKeys = (a, b) => bytesToHex(a.view) === bytesToHex(b.view)
  && bytesToHex(a.spend) === bytesToHex(b.spend);

/**
 * What a sign request must show before it is signed. Throws SignRefusedError naming the first
 * thing that is wrong.
 *
 * @param {Object} request The backend's sign request
 * @param {Object} context
 * @param {bigint} context.b The spend secret
 * @param {Uint8Array} context.pubB
 * @param {{ to: string, amount: bigint, tokenId: string }} context.intent What the user approved
 * @param {string} context.nativeTokenId The network's native token (pinned)
 * @param {string} context.serviceViewPub The wallet service's view key (pinned)
 * @param {string} [context.wireFormat] The network's wire format, 'v2' or 'v3' (pinned)
 * @param {string} [context.amountWidth] The network's amount width, 'u64' or 'u128'
 * @param {bigint} context.maxFee The most the user agreed to pay
 * @param {number} [context.nowS] The time, in unix seconds
 * @returns {{ bytes: Uint8Array, tx: Object, signingHash: Uint8Array, secrets: bigint[],
 *   keys: Uint8Array[] }}
 */
export function checkSignRequest(request, {
  b,
  pubB,
  intent,
  nativeTokenId,
  serviceViewPub,
  wireFormat,
  amountWidth,
  maxFee,
  nowS = Math.floor(Date.now() / 1000),
}) {
  // A request past its time holds outputs the wallet service may have handed to another payment:
  // signed, it could only fail, or conflict.
  if (!Number.isSafeInteger(request.expires_at) || request.expires_at <= nowS) {
    refuse('The payment expired before it was signed.');
  }
  let bytes;
  let tx;
  try {
    bytes = hexToBytes(request.unsigned_tx);
    tx = parseTx(bytes);
  } catch (e) {
    refuse(`The transaction can't be read: ${e.message}`);
  }
  // Another format than the network's is refused there, and its inputs would stay held by the
  // sign-once ledger until then.
  if (wireFormat && tx.format !== wireFormat) {
    refuse(`The transaction is ${tx.format}; this network takes ${wireFormat}.`);
  }
  // The version byte, not only the family: a u128 transaction on a u64 network is refused there.
  if (amountWidth && tx.width !== amountWidth) {
    refuse(`The transaction's amounts are ${tx.width}; this network takes ${amountWidth}.`);
  }
  const signingHash = signingHashOf(bytes, tx);
  // This shape names no token: its outputs hide theirs and the fee is native. A table makes a
  // transaction the network refuses, whose inputs would stay locked by the sign-once ledger.
  if (tx.table.length !== 0) {
    refuse('The transaction carries a token table.');
  }

  if (!verifyIn(EXCESS_DOMAIN, tx.excess.point, signingHash, tx.excess.signature)) {
    refuse('The transaction\'s excess signature is wrong.');
  }
  // An identity excess signs for nothing, and a v3 network refuses it.
  if (tx.format === 'v3' && tx.excess.point.every((byte) => byte === 0)) {
    refuse('The transaction\'s excess is the identity.');
  }

  // The fee: in the native token, as quoted, and no more than the user agreed to.
  if (tx.feeTokenIndex !== TOKEN_INDEX_NATIVE) {
    refuse('The fee is not paid in the native token.');
  }
  if (tx.feeAmount !== BigInt(request.fee) || tx.feeAmount > maxFee) {
    refuse('The fee is not the one the user agreed to.');
  }

  // The inputs: each one this wallet's, whose one-time secret is otk_offset + b, and the one the
  // transaction spends at that position, so the ledger records the outputs really spent.
  const inputs = request.inputs ?? [];
  if (inputs.length !== tx.nIn) {
    refuse('The inputs don\'t match the transaction.');
  }
  // An output spent twice in one transaction is refused by the network.
  if (new Set(tx.inputs.map((input) => input.outputIndex.toString())).size !== tx.nIn) {
    refuse('The transaction spends an output twice.');
  }
  const secrets = [];
  const keys = [];
  for (const [i, input] of inputs.entries()) {
    const spends = input.global_index === undefined ? null : BigInt(input.global_index);
    if (spends !== tx.inputs[i].outputIndex) {
      refuse('An input is not the output the transaction spends.');
    }
    // The offset as a canonical scalar: another encoding of it would name the same key.
    const offsetBytes = hexToBytes(input.otk_offset);
    const offset = bytesToBigintLE(offsetBytes);
    if (offsetBytes.length !== 32 || offset >= ORDER) {
      refuse('An input\'s offset is not a canonical scalar.');
    }
    const p = modOrder(offset + b);
    const key = hexToBytes(input.one_time_key);
    if (bytesToHex(publicKeyOf(p)) !== bytesToHex(key)) {
      refuse('An input is not this wallet\'s.');
    }
    secrets.push(p);
    keys.push(key);
  }

  // The outputs: every one opened from the bytes, so what follows is what the transaction pays.
  const outputs = request.outputs ?? [];
  let recipients;
  try {
    recipients = outputs.map((o) => ({
      address: o.address,
      amount: BigInt(o.amount),
      tokenId: hexToBytes(o.token),
    }));
    checkOpening(tx, recipients, hexToBytes(request.sender_opening));
  } catch (e) {
    refuse(`The outputs don't open: ${e.message}`);
  }

  // Exactly the user's payment, and change back to this wallet in the payment's token or the
  // native one. A backend calling a stranger's output "change" is caught here.
  const own = { view: hexToBytes(serviceViewPub), spend: pubB };
  const payments = outputs.filter((o) => !o.is_change);
  if (payments.length !== 1) {
    refuse('The transaction doesn\'t make exactly the user\'s payment.');
  }
  const [payment] = payments;
  const keysOf = (address) => {
    try {
      return decodeAddressKeys(address);
    } catch (e) {
      return refuse(`An address can't be read: ${e.message}`);
    }
  };
  if (
    !sameKeys(keysOf(payment.address), keysOf(intent.to))
    || BigInt(payment.amount) !== intent.amount
    || payment.token !== intent.tokenId
  ) {
    refuse('The transaction pays someone or something else than the user approved.');
  }
  for (const change of outputs.filter((o) => o.is_change)) {
    if (!sameKeys(keysOf(change.address), own)) {
      refuse('A change output pays another wallet.');
    }
    if (change.token !== intent.tokenId && change.token !== nativeTokenId) {
      refuse('A change output is in an unexpected token.');
    }
  }
  return { bytes, tx, signingHash, secrets, keys };
}

/** How many settled entries a ledger keeps: the newest, to tell a request again for one apart. */
export const MAX_SETTLED_ENTRIES = 200;

/**
 * Hathor Next's sign-once ledger: every input this wallet signed, with the transaction it signed
 * it into. Saved before any signature leaves the app. An input is never signed into a second,
 * different transaction: the two would conflict and the network would burn it. Signing the same
 * transaction again returns the signatures already made, so its bytes and id don't change.
 *
 * An input is the output it spends, named by its global index, never by its one-time key: a
 * declared output pays the wallet's spend key itself, so all of a wallet's declared coins share
 * one key, and keyed by it the first one spent would hold every other. An entry saved before the
 * ledger named outputs has them read from its signed bytes; one whose bytes don't read holds by
 * its keys, which can only hold more.
 *
 * An entry ends one of two ways. Recorded: the chain has the transaction, its inputs are spent.
 * Rejected: the backend says the transaction can never land, and its inputs are free again: the
 * network refused it by name, it expired before the backend took its signatures, or the wallet
 * service no longer keeps it, so it can't be submitted again. The app trusts that answer as it
 * trusts the backend's `rejected`. A settled entry is kept small, without its signed bytes, and
 * only the newest MAX_SETTLED_ENTRIES of them are kept. Nothing else frees an input: a payment
 * whose fate is unknown goes out again, byte for byte.
 *
 * @param {{ getItem: Function, setItemAsync: Function }} storage A durable write is awaited
 * @param {string} key Where the ledger is saved
 */
export function createSignLedger(storage, key) {
  const load = () => storage.getItem(key) ?? { entries: [] };
  // The store's memory takes a value before its write to disk ends: a write that fails puts the
  // value that was there back, so no entry counts that isn't on disk.
  const save = async (entries) => {
    const previous = load();
    try {
      await storage.setItemAsync(key, { entries });
    } catch (e) {
      storage.setItemAsync(key, previous).catch(() => {});
      throw e;
    }
  };
  const outputsOf = (entry) => {
    if (Array.isArray(entry.outputs)) {
      return entry.outputs;
    }
    try {
      return spentOutputsOfBytes(hexToBytes(entry.signedTx));
    } catch (e) {
      return null;
    }
  };
  // A settled entry keeps only what the check needs, so the ledger stays small: it is one row of
  // the storage the app reads whole at every start. The outputs a recorded transaction spent go
  // on holding, and the newest settled entries are kept, up to MAX_SETTLED_ENTRIES.
  const settle = async (txId, patch) => {
    const { entries } = load();
    if (!entries.some((e) => e.txId === txId && !e.recorded && !e.rejected)) {
      return;
    }
    const settled = entries.map((e) => (e.txId === txId ? compact({ ...e, ...patch }) : e));
    const pending = settled.filter((e) => !e.recorded && !e.rejected);
    const done = settled.filter((e) => e.recorded || e.rejected)
      .sort((a, b) => (b.signedAt ?? 0) - (a.signedAt ?? 0))
      .slice(0, MAX_SETTLED_ENTRIES);
    await save([...pending, ...done]);
  };
  const compact = (entry) => ({
    txId: entry.txId,
    sendId: entry.sendId,
    signingHash: entry.signingHash,
    outputs: outputsOf(entry) ?? [],
    signedAt: entry.signedAt,
    ...(entry.recorded ? { recorded: true } : {}),
    ...(entry.rejected
      ? { rejected: true, rejectedAt: entry.rejectedAt, reason: entry.reason }
      : {}),
  });
  return {
    /**
     * @param {Uint8Array} signingHash
     * @param {string[]} outputs The outputs the inputs spend, by global index (spentOutputs)
     * @param {Uint8Array[]} keys The inputs' one-time keys, for an entry whose outputs don't read
     * @returns {Object|null} The entry of this same transaction, if it was signed before
     * @throws {LedgerConflictError} When an input was signed into another transaction
     */
    check(signingHash, outputs, keys) {
      const hash = bytesToHex(signingHash);
      const spends = new Set(outputs);
      const named = new Set(keys.map(bytesToHex));
      for (const entry of load().entries) {
        const held = entry.rejected ? [] : outputsOf(entry);
        const holds = held === null
          ? entry.inputs.some((k) => named.has(k))
          : held.some((g) => spends.has(g));
        if (holds) {
          if (entry.signingHash === hash) {
            return entry;
          }
          throw new LedgerConflictError(entry);
        }
      }
      return null;
    },

    /**
     * Saves an entry, and resolves only once it is on disk.
     *
     * @param {Object} entry
     */
    async record(entry) {
      await save([...load().entries, entry]);
    },

    /**
     * The transaction made it into the chain: its inputs are spent, and it needs no resubmit.
     *
     * @param {string} txId
     */
    async markRecorded(txId) {
      await settle(txId, { recorded: true });
    },

    /**
     * The network refused the transaction, or it expired before the backend took its signatures:
     * its inputs are free for another one.
     *
     * @param {string} txId
     * @param {string|null} reason
     */
    async markRejected(txId, reason) {
      await settle(txId, { rejected: true, rejectedAt: Date.now(), reason: reason ?? null });
    },

    /** @returns {Object[]} Entries that still hold their inputs: neither recorded nor rejected */
    pending() {
      return load().entries.filter((e) => !e.recorded && !e.rejected);
    },

    /** @returns {Object[]} */
    entries() {
      return load().entries;
    },
  };
}

/**
 * Checks a sign request, then signs it once. The signed transaction is saved in the ledger, on
 * disk, before the signatures are returned, so the identical bytes can always be submitted again.
 * A save that fails throws, and the signatures are dropped.
 *
 * @param {Object} request The backend's sign request
 * @param {Object} context See checkSignRequest, plus `ledger` (createSignLedger)
 * @returns {Promise<{ signatures: string[], signedTx: string, txId: string }>} Hex
 */
export async function verifyAndSign(request, context) {
  const { bytes, tx, signingHash, secrets, keys } = checkSignRequest(request, context);
  const outputs = spentOutputs(tx);
  const previous = context.ledger.check(signingHash, outputs, keys);
  if (previous && !previous.signatures) {
    // Settled and kept small: a transaction recorded once is never signed again.
    refuse('This transaction was already recorded.');
  }
  if (previous) {
    return {
      signatures: previous.signatures,
      signedTx: previous.signedTx,
      txId: previous.txId,
    };
  }
  const signatures = secrets.map((p, i) => signInput(p, keys[i], signingHash));
  const signed = withInputSignatures(bytes, tx, signatures);
  const result = {
    signatures: signatures.map(bytesToHex),
    signedTx: bytesToHex(signed),
    txId: bytesToHex(txIdOf(signed)),
  };
  await context.ledger.record({
    sendId: request.id,
    signingHash: bytesToHex(signingHash),
    outputs,
    inputs: keys.map(bytesToHex),
    ...result,
    signedAt: Date.now(),
  });
  return result;
}
