/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { utf8ToBytes } from '@noble/hashes/utils';
import { decodeAddressKeys } from './kit/address';
import { EXCESS_DOMAIN, signInput, verifyIn } from './kit/inputSig';
import { publicKeyOf } from './kit/keys';
import { CREATED_TOKEN_ID, checkOpening, checkOpeningLevels } from './kit/opening';
import {
  bytesToBigintLE,
  bytesToHex,
  hexToBytes,
  modOrder,
  ORDER,
} from './kit/scalar';
import { TOKEN_INDEX_NATIVE } from './kit/txV2';
import {
  parseIssuanceTx,
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
 * A token creation spends other than one coin: several would come back as one public change,
 * linked on chain, and a coin its fee doesn't need would add its whole amount to it.
 */
export class CoinsNotNeededError extends SignRefusedError {
  constructor() {
    super('The token creation doesn\'t pay its fee from exactly one coin.');
    this.name = 'CoinsNotNeededError';
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
 * The inputs: each one this wallet's, whose one-time secret is otk_offset + b, and the one the
 * transaction spends at that position, so the ledger records the outputs really spent.
 *
 * @returns {{ secrets: bigint[], keys: Uint8Array[] }}
 */
function ownInputs(request, tx, b) {
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
  return { secrets, keys };
}

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

  const { secrets, keys } = ownInputs(request, tx, b);

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
 * What a token creation's sign request must show before it is signed: exactly the token the user
 * approved, its supply paid to this wallet, and the rest of the money back to this wallet. Throws
 * SignRefusedError naming the first thing that is wrong.
 *
 * The keys in the token's body are this wallet's own, derived from its words, so a restored wallet
 * still holds them; a body naming any other key would give the token's mint and melt powers to
 * whoever holds that one. The supply and the change are public by the protocol (a creation's
 * outputs are transparent): the user is told so before approving, and sees the change's amount
 * (publicChange) before it is signed.
 *
 * So a creation spends exactly one coin, or none for no fee and no change. Each coin it spends
 * goes into that public change, and several are linked by it on chain; a backend spending every
 * coin would publish the whole balance. The app can't read a hidden coin's amount, so it can't
 * tell a coin the fee doesn't need from one it does (coins of 2 and 108 for a fee of 100 read as
 * coins of 54 and 56): it allows one coin only. A largest-first choice takes one coin whenever one
 * covers the fee; a wallet whose coins are all smaller than the fee is refused, and sending some
 * HTR to its own address first makes one coin of them.
 *
 * @param {Object} request The backend's sign request
 * @param {Object} context
 * @param {bigint} context.b The spend secret
 * @param {Uint8Array} context.pubB
 * @param {{ symbol: string, name: string, amount: bigint, mintAuthority: Uint8Array,
 *   meltAuthority: Uint8Array }} context.intent What the user approved, with the authority keys
 *   this wallet derived for it
 * @param {string} context.nativeTokenId The network's native token (pinned)
 * @param {string} context.serviceViewPub The wallet service's view key (pinned)
 * @param {bigint} context.maxFee The most the user agreed to pay
 * @param {string} [context.amountWidth] The network's amount width, 'u64' or 'u128'
 * @param {number} [context.nowS] The time, in unix seconds
 * @returns {{ bytes: Uint8Array, tx: Object, signingHash: Uint8Array, secrets: bigint[],
 *   keys: Uint8Array[], publicChange: bigint }} publicChange: the native token the creation pays
 *   back to this wallet, in the open
 */
export function checkCreateRequest(request, {
  b,
  pubB,
  intent,
  nativeTokenId,
  serviceViewPub,
  maxFee,
  amountWidth,
  nowS = Math.floor(Date.now() / 1000),
}) {
  if (!Number.isSafeInteger(request.expires_at) || request.expires_at <= nowS) {
    refuse('The token creation expired before it was signed.');
  }
  let bytes;
  let tx;
  try {
    bytes = hexToBytes(request.unsigned_tx);
    tx = parseIssuanceTx(bytes);
  } catch (e) {
    refuse(`The transaction can't be read: ${e.message}`);
  }
  if (tx.kind !== 'token-create' || request.issuance?.kind !== 'token-create') {
    refuse('The transaction is not a token creation.');
  }
  // The version byte names the amounts' width: another than the network's is refused there.
  if (amountWidth && tx.width !== amountWidth) {
    refuse(`The transaction's amounts are ${tx.width}; this network takes ${amountWidth}.`);
  }
  // Its outputs pay the token it creates and the native one, neither of which the table lists: a
  // table makes a creation the network refuses, whose inputs would stay held until then.
  if (tx.table.length !== 0) {
    refuse('The creation carries a token table.');
  }
  const signingHash = signingHashOf(bytes, tx);
  // Nothing hidden (every input public, every output transparent) closes with no excess; anything
  // else must, and its signature over these bytes must hold.
  if (tx.excess && !verifyIn(EXCESS_DOMAIN, tx.excess.point, signingHash, tx.excess.signature)) {
    refuse('The transaction\'s excess signature is wrong.');
  }
  // An identity excess signs for nothing, and the network refuses it.
  if (tx.excess && tx.excess.point.every((byte) => byte === 0)) {
    refuse('The transaction\'s excess is the identity.');
  }
  if (tx.feeTokenIndex !== TOKEN_INDEX_NATIVE) {
    refuse('The fee is not paid in the native token.');
  }
  if (tx.feeAmount !== BigInt(request.fee) || tx.feeAmount > maxFee) {
    refuse('The fee is not the one the user agreed to.');
  }

  // The token itself: the body holds exactly what the user read on the screen, and this wallet's
  // own two keys.
  const same = (x, y) => x !== null && y !== null && bytesToHex(x) === bytesToHex(y);
  const { definition } = tx;
  if (!same(definition.symbol, utf8ToBytes(intent.symbol))
    || !same(definition.name, utf8ToBytes(intent.name))) {
    refuse('The token is not the one the user approved.');
  }
  if (!same(definition.mintAuthority, intent.mintAuthority)
    || !same(definition.meltAuthority, intent.meltAuthority)) {
    refuse('The token\'s mint or melt key is not this wallet\'s.');
  }

  const { secrets, keys } = ownInputs(request, tx, b);

  // A creation's outputs have one level, the protocol's: transparent, paid to the recipient's
  // spend key (declared). Held to that from the bytes, never to what the backend says each is.
  if (tx.outputs.some((o) => o.form !== 'transparent')) {
    refuse('A token creation\'s outputs are transparent.');
  }
  // Every output opened from the bytes at that level: what follows is what the transaction pays.
  const outputs = request.outputs ?? [];
  const native = hexToBytes(nativeTokenId);
  try {
    const recipients = outputs.map((o) => ({
      address: o.address,
      amount: BigInt(o.amount),
      tokenId: hexToBytes(o.token),
      level: 1,
    }));
    checkOpeningLevels(tx, recipients, hexToBytes(request.sender_opening), native);
  } catch (e) {
    refuse(`The outputs don't open: ${e.message}`);
  }

  // All of it to this wallet: the supply, exactly the approved amount, and change in the native
  // token. A backend paying any of it elsewhere is caught here.
  const own = { view: hexToBytes(serviceViewPub), spend: pubB };
  const created = bytesToHex(CREATED_TOKEN_ID);
  let supply = 0n;
  let change = 0n;
  for (const o of outputs) {
    let keysOf;
    try {
      keysOf = decodeAddressKeys(o.address);
    } catch (e) {
      refuse(`An address can't be read: ${e.message}`);
    }
    if (!sameKeys(keysOf, own)) {
      refuse('An output of the token creation pays another wallet.');
    }
    if (o.token === created) {
      // The created token is held by transparent outputs only: the opening has already matched
      // each claim to its output.
      supply += BigInt(o.amount);
    } else if (o.token === nativeTokenId) {
      change += BigInt(o.amount);
    } else {
      refuse('An output of the token creation is in an unexpected token.');
    }
  }
  if (supply !== intent.amount) {
    refuse('The token\'s supply is not the amount the user approved.');
  }
  const oneCoin = tx.nIn === 1 && tx.feeAmount > 0n;
  const free = tx.nIn === 0 && tx.feeAmount === 0n && change === 0n;
  if (!oneCoin && !free) {
    throw new CoinsNotNeededError();
  }
  return { bytes, tx, signingHash, secrets, keys, publicChange: change };
}

/**
 * Hathor Next's sign-once ledger: every input this wallet signed, with the transaction it signed
 * it into. Saved before any signature leaves the app. An input is never signed into a second,
 * different transaction: the two would conflict and the network would burn it. Signing the same
 * transaction again returns the signatures already made, so its bytes and id don't change.
 *
 * An input is the output it spends, named by its global index, never by its one-time key: a
 * declared output (a token creation's supply and change) pays the wallet's spend key itself, so
 * all of a wallet's declared coins share one key, and keyed by it the first one spent would hold
 * every other. An entry saved before the ledger named outputs has them read from its signed
 * bytes; one whose bytes don't read holds by its keys, which can only hold more.
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
  // Entries asked to be saved whose write hasn't ended: every check counts them already.
  const saving = [];
  // Writes run one at a time, in the order asked: each reads the ledger when its turn comes, so
  // none undoes another.
  let writes = Promise.resolve();
  const serially = (op) => {
    const run = writes.then(op);
    writes = run.catch(() => {});
    return run;
  };
  // The store's memory takes a value before its write to disk ends: a write that fails puts the
  // value that was there back, so no entry counts that isn't on disk. No other write ran since,
  // so that value holds everything they saved.
  const save = async (entries) => {
    const previous = load();
    try {
      await storage.setItemAsync(key, { entries });
    } catch (e) {
      await storage.setItemAsync(key, previous).catch(() => {});
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
  const settle = (txId, patch) => serially(async () => {
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
  });
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
      for (const entry of [...load().entries, ...saving]) {
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
      saving.push(entry);
      try {
        await serially(() => save([...load().entries, entry]));
      } finally {
        saving.splice(saving.indexOf(entry), 1);
      }
    },

    /**
     * Takes in the entries of a ledger kept before under another key: those still on their way
     * hold their outputs here too. One already here is kept as it is.
     *
     * @param {Object[]} entries
     */
    async adopt(entries) {
      await serially(async () => {
        const current = load().entries;
        const known = new Set(current.map((e) => e.txId));
        const pending = entries.filter((e) => e && typeof e.txId === 'string'
          && !known.has(e.txId) && !e.recorded && !e.rejected);
        if (pending.length > 0) {
          await save([...current, ...pending]);
        }
      });
    },

    /** Resolves once every write asked for so far ended, saved or not. */
    flush() {
      return writes;
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
 * @param {Function} [check] checkSignRequest for a payment, checkCreateRequest for a token
 *   creation: what the request must show before anything is signed
 * @returns {Promise<{ signatures: string[], signedTx: string, txId: string }>} Hex
 */
export async function verifyAndSign(request, context, check = checkSignRequest) {
  let checked;
  try {
    checked = check(request, context);
  } catch (e) {
    // A request that can't even be read (a field missing, not a number, not hex) is refused like
    // a wrong one: nothing was signed, and the caller lets its outputs go.
    if (e instanceof SignRefusedError) {
      throw e;
    }
    throw new SignRefusedError(`The request can't be read: ${e.message}`);
  }
  const { bytes, tx, signingHash, secrets, keys } = checked;
  const outputs = spentOutputs(tx);
  let previous = context.ledger.check(signingHash, outputs, keys);
  if (previous) {
    // Its write may still be on its way: its signatures leave again only once it is on disk. One
    // whose write failed is gone, and this transaction is signed as new.
    await context.ledger.flush();
    previous = context.ledger.check(signingHash, outputs, keys);
  }
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
