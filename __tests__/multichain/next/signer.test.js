/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  beforeEach,
  describe,
  it,
  expect,
  test,
} from '@jest/globals';
import vectors from './fixtures/remote-signing.json';
import {
  LedgerConflictError,
  SignRefusedError,
  checkSignRequest,
  createSignLedger,
  MAX_SETTLED_ENTRIES,
  verifyAndSign,
} from '../../../src/multichain/next/signer';
import { INPUT_DOMAIN, verifyIn } from '../../../src/multichain/next/kit/inputSig';
import {
  parseTx,
  signingHashOf,
  spentOutputsOfBytes,
  txIdOf,
} from '../../../src/multichain/next/kit/tx';
import { decodeAddressKeys, encodeAddress } from '../../../src/multichain/next/kit/address';
import { publicKeyOf } from '../../../src/multichain/next/kit/keys';
import {
  bigintToBytesLE,
  bytesToBigintLE,
  bytesToHex,
  concatBytes,
  hexToBytes,
  modOrder,
  ORDER,
} from '../../../src/multichain/next/kit/scalar';
import { REASON_MAX_LENGTH } from '../../../src/multichain/next/reasonText';
import { SEND_1, SEND_2 } from '../fakes/sendIds';
import {
  forge,
  inputsOf,
  memoryStorage,
  payingTo,
  refusal,
} from '../fakes/signing';

const [CASE] = vectors.cases;
const V3 = vectors.cases.find((c) => c.format === 'v3');
const NATIVE = vectors.native_token;
const NOW = 1788000000;

// The outputs a vector's inputs spend, as the ledger names them.
const spentOf = (vector) => inputsOf(vector).map((input) => String(input.global_index));

function requestOf(vector, patch = {}) {
  return {
    id: SEND_1,
    unsigned_tx: vector.unsigned_tx,
    signing_hash: vector.signing_hash,
    sender_opening: vector.sender_opening,
    inputs: inputsOf(vector),
    outputs: vector.outputs,
    fee: vector.fee,
    expires_at: 4000000000,
    ...patch,
  };
}

// What the user approved in the app, as each vector states it: one payment and a fee ceiling.
function contextOf(vector, overrides = {}) {
  const [payment] = vector.approved.payments;
  return {
    b: bytesToBigintLE(hexToBytes(vector.b)),
    pubB: hexToBytes(vector.pub_b),
    intent: { to: payment.address, amount: BigInt(payment.amount), tokenId: payment.token },
    nativeTokenId: NATIVE,
    serviceViewPub: vector.pub_a,
    wireFormat: vector.format,
    maxFee: BigInt(vector.approved.max_fee),
    nowS: NOW,
    ledger: createSignLedger(memoryStorage(), 'ledger'),
    ...overrides,
  };
}

// What a backend could send as a send's id instead of its own: 16 bytes in lowercase hex.
const NOT_SEND_IDS = [
  undefined, null, '', 7, 'send-1', SEND_1.toUpperCase(), `${SEND_1}0`, SEND_1.slice(1),
  `../${SEND_1.slice(3)}`, `${SEND_1.slice(0, 31)}g`, 'a'.repeat(3000000),
];

// The refusal's words, so that no other check refusing the same request can stand in for the one
// a case is about.
const refusedFor = (request, context = contextOf(CASE)) => {
  const e = refusal(() => checkSignRequest(request, context));
  expect(e).toBeInstanceOf(SignRefusedError);
  return e.message;
};

const PAYS_ELSE = 'The transaction pays someone or something else than the user approved.';

describe('signing a Hathor Next sign request', () => {
  let context;
  beforeEach(() => {
    context = contextOf(CASE);
  });

  it('signs a request that makes exactly the approved payment, with valid signatures', async () => {
    const result = await verifyAndSign(requestOf(CASE), context);
    const unsigned = hexToBytes(CASE.unsigned_tx);
    const hash = signingHashOf(unsigned, parseTx(unsigned));
    result.signatures.forEach((sig, i) => {
      expect(verifyIn(INPUT_DOMAIN, hexToBytes(CASE.inputs[i].one_time_key), hash, hexToBytes(sig)))
        .toBe(true);
    });
    expect(result.txId).toBe(bytesToHex(txIdOf(hexToBytes(result.signedTx))));
    expect(context.ledger.entries()).toHaveLength(1);
  });

  const payee = (intent) => decodeAddressKeys(intent.to);
  it.each([
    ['someone else', (intent) => ({
      ...intent, to: encodeAddress(CASE.pub_a, bytesToHex(publicKeyOf(5n))),
    })],
    ['the payee\'s spend key under another view key', (intent) => ({
      ...intent,
      to: encodeAddress(bytesToHex(publicKeyOf(9n)), bytesToHex(payee(intent).spend)),
    })],
    ['the payee\'s view key with another spend key', (intent) => ({
      ...intent,
      to: encodeAddress(bytesToHex(payee(intent).view), bytesToHex(publicKeyOf(5n))),
    })],
    ['one unit more', (intent) => ({ ...intent, amount: intent.amount + 1n })],
    ['one unit less', (intent) => ({ ...intent, amount: intent.amount - 1n })],
    ['another token', (intent) => ({ ...intent, tokenId: 'ab'.repeat(32) })],
  ])('refuses a payment when the user approved %s', (name, change) => {
    expect(refusedFor(requestOf(CASE), { ...context, intent: change(context.intent) }))
      .toBe(PAYS_ELSE);
  });

  it('refuses a payment the backend calls change', () => {
    const outputs = CASE.outputs.map((o) => ({ ...o, is_change: true }));
    expect(refusedFor(requestOf(CASE, { outputs })))
      .toBe('The transaction doesn\'t make exactly the user\'s payment.');
  });

  it('refuses outputs that the bytes do not pay', () => {
    const outputs = CASE.outputs.map((o, i) => (
      i === 0 ? { ...o, amount: String(BigInt(o.amount) - 1n) } : o
    ));
    expect(refusedFor(requestOf(CASE, { outputs })))
      .toBe('The outputs don\'t open: Output 0 doesn\'t pay what it says.');
  });

  it('refuses a fee above what the user agreed to, or not the one in the bytes', () => {
    const fee = 'The fee is not the one the user agreed to.';
    // One unit above the ceiling, and a quote that is not what the bytes pay.
    expect(refusedFor(requestOf(CASE), { ...context, maxFee: BigInt(CASE.fee) - 1n })).toBe(fee);
    expect(refusedFor(requestOf(CASE, { fee: String(BigInt(CASE.fee) + 1n) }))).toBe(fee);
    expect(refusedFor(requestOf(CASE, { fee: '1' }))).toBe(fee);
    // A fee of exactly the ceiling is taken.
    const atCeiling = { ...context, maxFee: BigInt(CASE.fee) };
    expect(refusal(() => checkSignRequest(requestOf(CASE), atCeiling))).toBeNull();
  });

  it('refuses an input that is not this wallet\'s', () => {
    const inputs = inputsOf(CASE).map((i, k) => (
      k === 0 ? { ...i, otk_offset: '01'.padEnd(64, '0') } : i
    ));
    expect(refusedFor(requestOf(CASE, { inputs }))).toBe('An input is not this wallet\'s.');
    expect(refusedFor(requestOf(CASE), contextOf(CASE, { b: 12345n })))
      .toBe('An input is not this wallet\'s.');
  });

  it('refuses a broken excess signature or unreadable bytes', () => {
    const bytes = hexToBytes(CASE.unsigned_tx);
    bytes[bytes.length - 1] = bytes[bytes.length - 1] === 0 ? 1 : 0;
    expect(refusedFor(requestOf(CASE, { unsigned_tx: bytesToHex(bytes) })))
      .toBe('The transaction\'s excess signature is wrong.');
    expect(refusedFor(requestOf(CASE, { unsigned_tx: 'zz' })))
      .toBe('The transaction can\'t be read: Not hexadecimal.');
  });

  // A field missing or not a number is refused like a wrong one: the caller lets its outputs go.
  it('refuses, as a refusal, a request with a field it can\'t read', async () => {
    const request = requestOf(CASE);
    delete request.fee;
    const why = refusal(() => BigInt(undefined)).message;
    const e = await verifyAndSign(request, context).catch((thrown) => thrown);
    expect(e).toBeInstanceOf(SignRefusedError);
    expect(e.message).toBe(`The request can't be read: ${why}`);
    expect(context.ledger.entries()).toEqual([]);
  });

  it('never signs an input into two transactions, and repeats the same signatures for the same one', async () => {
    const first = await verifyAndSign(requestOf(CASE), context);
    const again = await verifyAndSign(requestOf(CASE, { id: SEND_2 }), context);
    expect(again).toEqual(first);
    expect(context.ledger.entries()).toHaveLength(1);

    // The same inputs, another transaction: a conflict the network would burn.
    const other = { ...CASE, unsigned_tx: CASE.unsigned_tx };
    const bytes = hexToBytes(other.unsigned_tx);
    const tx = parseTx(bytes);
    const fakeHash = signingHashOf(bytes, tx);
    fakeHash[0] = fakeHash[0] === 0 ? 1 : 0;
    const inputKeys = CASE.inputs.map((i) => hexToBytes(i.one_time_key));
    const conflict = refusal(() => context.ledger.check(fakeHash, spentOf(CASE), inputKeys));
    expect(conflict).toBeInstanceOf(LedgerConflictError);
    expect(conflict.entry.txId).toBe(first.txId);
  });
});

describe.each(vectors.cases)('the remote-signing case "$name"', (vector) => {
  it('is signed, in its own format', async () => {
    const context = contextOf(vector);
    const result = await verifyAndSign(requestOf(vector), context);
    // Signatures are randomized: the same length as the builder's signed bytes, not the same bytes.
    expect(result.signedTx).toHaveLength(vector.signed_tx.length);
    const unsigned = hexToBytes(vector.unsigned_tx);
    const hash = signingHashOf(unsigned, parseTx(unsigned));
    expect(bytesToHex(hash)).toBe(vector.signing_hash);
    result.signatures.forEach((sig, i) => {
      const key = hexToBytes(vector.inputs[i].one_time_key);
      expect(verifyIn(INPUT_DOMAIN, key, hash, hexToBytes(sig))).toBe(true);
    });
    expect(result.txId).toBe(bytesToHex(txIdOf(hexToBytes(result.signedTx))));
  });

  it('is refused on a network of the other format', () => {
    const other = vector.format === 'v2' ? 'v3' : 'v2';
    expect(refusedFor(requestOf(vector), contextOf(vector, { wireFormat: other })))
      .toBe(`The transaction is ${vector.format}; this network takes ${other}.`);
  });

  // Every request carries the true hash: one naming another must still be signed over the bytes'
  // own, or the backend could have the inputs sign a transaction other than the one checked.
  it('signs the hash of its own bytes, whatever signing_hash the request names', async () => {
    const other = 'ab'.repeat(32);
    const context = contextOf(vector);
    const result = await verifyAndSign(requestOf(vector, { signing_hash: other }), context);
    const own = hexToBytes(vector.signing_hash);
    result.signatures.forEach((sig, i) => {
      const key = hexToBytes(vector.inputs[i].one_time_key);
      expect(verifyIn(INPUT_DOMAIN, key, own, hexToBytes(sig))).toBe(true);
      expect(verifyIn(INPUT_DOMAIN, key, hexToBytes(other), hexToBytes(sig))).toBe(false);
    });
    // The ledger names the transaction by that same hash.
    expect(context.ledger.entries()[0].signingHash).toBe(vector.signing_hash);
  });
});

// Every refused case verifies once signed: the network would take it. The amount leak is the
// one this signer does not refuse: it needs the wallet's own record of which outputs it holds are
// public, and the app keeps none. Counting every input as public instead would refuse a token
// payment whose native change is the only native output.
const SIGNER_REFUSES = {
  fee: 'The fee is not the one the user agreed to.',
  output: 'A change output pays another wallet.',
  input: 'An input is not this wallet\'s.',
};

describe.each(vectors.refused_cases.filter((r) => r.refusal in SIGNER_REFUSES))(
  'the refused case "$case.name"',
  ({ case: vector, refusal: kind }) => {
    it('is refused, for what it is', () => {
      expect(refusedFor(requestOf(vector), contextOf(vector))).toBe(SIGNER_REFUSES[kind]);
    });
  },
);

test('the refused cases are the ones this signer knows of', () => {
  expect(vectors.refused_cases.map((r) => r.refusal).sort())
    .toEqual([...Object.keys(SIGNER_REFUSES), 'amount leak'].sort());
});

describe('what the sign-once ledger and the inputs guard', () => {
  it('refuses inputs that are not the outputs the transaction spends', () => {
    const shifted = inputsOf(CASE).map((i) => ({ ...i, global_index: i.global_index + 1 }));
    const missing = CASE.inputs;
    expect(missing.some((i) => 'global_index' in i)).toBe(false);
    for (const inputs of [shifted, missing]) {
      expect(refusedFor(requestOf(CASE, { inputs })))
        .toBe('An input is not the output the transaction spends.');
    }
  });

  // A declared output pays the wallet's spend key itself, so two of its coins can share one key:
  // a token creation's change does, every time.
  describe('an input is the output it spends, not its key', () => {
    // An earlier transaction of this wallet: CASE's bytes, spending other outputs. In v2 an
    // input's output index is the 8 bytes before its signature.
    const EARLIER_TX = (() => {
      const bytes = hexToBytes(CASE.unsigned_tx);
      const view = new DataView(bytes.buffer, bytes.byteOffset);
      for (const input of parseTx(bytes).inputs) {
        view.setBigUint64(input.signatureOffset - 8, input.outputIndex + 100n, true);
      }
      return bytesToHex(bytes);
    })();
    const EARLIER_SPENT = spentOutputsOfBytes(hexToBytes(EARLIER_TX));
    const sameKeys = CASE.inputs.map((i) => i.one_time_key);
    const earlier = {
      sendId: 'earlier',
      signingHash: 'ab'.repeat(32),
      txId: 'cd'.repeat(32),
      signatures: [],
      signedAt: 1,
      recorded: true,
    };
    const otherHashOf = (vector) => {
      const bytes = hexToBytes(vector.unsigned_tx);
      const hash = signingHashOf(bytes, parseTx(bytes));
      hash[0] = hash[0] === 0 ? 1 : 0;
      return hash;
    };

    it('signs a coin whose key an earlier transaction\'s other coin shares', async () => {
      const context = contextOf(CASE);
      await context.ledger.record({
        ...earlier, signedTx: EARLIER_TX, outputs: EARLIER_SPENT, inputs: sameKeys,
      });
      expect(CASE.format).toBe('v2');
      expect(EARLIER_SPENT).toEqual(spentOf(CASE).map((g) => String(BigInt(g) + 100n)));
      const signed = await verifyAndSign(requestOf(CASE), context);
      expect(context.ledger.entries().map((e) => e.txId)).toEqual([earlier.txId, signed.txId]);
      expect(context.ledger.entries()[1].outputs).toEqual(spentOf(CASE));
    });

    it('still holds an output signed before, whatever key names it', async () => {
      const context = contextOf(CASE);
      const first = await verifyAndSign(requestOf(CASE), context);
      const conflict = refusal(() => context.ledger.check(
        otherHashOf(CASE),
        [spentOf(CASE)[1]],
        [new Uint8Array(32)],
      ));
      expect(conflict).toBeInstanceOf(LedgerConflictError);
      expect(conflict.entry.txId).toBe(first.txId);
    });

    it('reads the outputs of an entry saved before the ledger named them from its bytes', async () => {
      // The same keys, other outputs: free.
      const freeCtx = contextOf(CASE);
      await freeCtx.ledger.record({ ...earlier, signedTx: EARLIER_TX, inputs: sameKeys });
      await expect(verifyAndSign(requestOf(CASE), freeCtx)).resolves.toBeTruthy();

      // Other keys, the same outputs: held.
      const heldCtx = contextOf(CASE);
      await heldCtx.ledger.record({
        ...earlier, signedTx: CASE.unsigned_tx, inputs: ['00'.repeat(32), '11'.repeat(32)],
      });
      await expect(verifyAndSign(requestOf(CASE), heldCtx))
        .rejects.toBeInstanceOf(LedgerConflictError);
    });

    it('holds by key an entry whose outputs can\'t be read', async () => {
      const context = contextOf(CASE);
      await context.ledger.record({ ...earlier, signedTx: 'zz', inputs: sameKeys });
      await expect(verifyAndSign(requestOf(CASE), context))
        .rejects.toBeInstanceOf(LedgerConflictError);
      expect(context.ledger.check(otherHashOf(CASE), ['1', '2'], [new Uint8Array(32)])).toBeNull();
    });
  });

  it('gives no signature when the ledger can\'t be saved', async () => {
    const context = contextOf(CASE, {
      ledger: createSignLedger(memoryStorage({ failWrites: true }), 'ledger'),
    });
    await expect(verifyAndSign(requestOf(CASE), context)).rejects.toThrow('disk full');
    expect(context.ledger.entries()).toHaveLength(0);
  });

  // The ledger keeps the id with what was signed, and the app reads the ledger whole at every
  // start: an id the backend doesn't make is refused before anything is signed or kept.
  it('refuses a request whose id is not a send id, and keeps nothing', async () => {
    const context = contextOf(CASE);
    for (const id of NOT_SEND_IDS) {
      expect(refusal(() => checkSignRequest(requestOf(CASE, { id }), context)).message)
        .toBe('The payment has no valid id.');
      // eslint-disable-next-line no-await-in-loop
      await expect(verifyAndSign(requestOf(CASE, { id }), context))
        .rejects.toThrow('The payment has no valid id.');
    }
    expect(context.ledger.entries()).toHaveLength(0);
    expect(refusal(() => checkSignRequest(requestOf(CASE), context))).toBeNull();
  });

  it('refuses a request past its time, or with none', () => {
    const context = contextOf(CASE, { nowS: NOW });
    // Now, a second ago, none, as text, and a time that is no whole second.
    for (const expiresAt of [NOW, NOW - 1, undefined, '4000000000', NOW + 0.5]) {
      expect(refusedFor(requestOf(CASE, { expires_at: expiresAt }), context))
        .toBe('The payment expired before it was signed.');
    }
    expect(refusal(() => checkSignRequest(requestOf(CASE, { expires_at: NOW + 1 }), context)))
      .toBeNull();
  });

  it('frees the inputs of a transaction the network rejected, and keeps its entry', async () => {
    const context = contextOf(CASE);
    const { txId } = await verifyAndSign(requestOf(CASE), context);
    const bytes = hexToBytes(CASE.unsigned_tx);
    const otherHash = signingHashOf(bytes, parseTx(bytes));
    otherHash[0] = otherHash[0] === 0 ? 1 : 0;
    const inputKeys = CASE.inputs.map((i) => hexToBytes(i.one_time_key));
    expect(refusal(() => context.ledger.check(otherHash, spentOf(CASE), inputKeys)))
      .toBeInstanceOf(LedgerConflictError);

    await context.ledger.markRejected(txId, 'fee too low');
    expect(context.ledger.check(otherHash, spentOf(CASE), inputKeys)).toBeNull();
    expect(context.ledger.pending()).toHaveLength(0);
    expect(context.ledger.entries()).toMatchObject([{ txId, rejected: true, reason: 'fee too low' }]);
  });

  it('never frees the inputs of a recorded transaction, nor revives a settled entry', async () => {
    const context = contextOf(CASE);
    const { txId } = await verifyAndSign(requestOf(CASE), context);
    await context.ledger.markRecorded(txId);
    await context.ledger.markRejected(txId, 'late');
    expect(context.ledger.entries()[0]).toMatchObject({ recorded: true });
    expect(context.ledger.entries()[0].rejected).toBeUndefined();
  });

  it('marks a transaction recorded once the chain has it', async () => {
    const context = contextOf(CASE);
    const { txId } = await verifyAndSign(requestOf(CASE), context);
    await context.ledger.markRecorded(txId);
    expect(context.ledger.entries()[0].recorded).toBe(true);
  });
});

// Each check on its own: every request below breaks only what one check guards, and the refusal
// must name that check, so no other check can stand in for it.
describe('each check of a payment, on its own', () => {
  const PAY_AT = CASE.outputs.findIndex((o) => !o.is_change);
  const CHANGE_AT = CASE.outputs.findIndex((o) => o.is_change);
  const CHANGE = CASE.outputs[CHANGE_AT];
  const OTHER_TOKEN = 'cd'.repeat(32);
  const claimsWith = (j, patch) => CASE.outputs.map((o, i) => (i === j ? { ...o, ...patch } : o));

  it('passes a forged transaction that changes nothing, so each case below fails one check', () => {
    expect(CASE.format).toBe('v2');
    const untouched = forge(CASE, (b) => b);
    const request = requestOf(CASE, { unsigned_tx: untouched });
    expect(refusal(() => checkSignRequest(request, contextOf(CASE)))).toBeNull();
    // Writing the change as it already is changes no byte: the rewrite hits the right fields.
    expect(forge(CASE, payingTo(CASE, CHANGE_AT, CHANGE))).toBe(untouched);
  });

  it('refuses a transaction carrying a token table', () => {
    const withTable = forge(CASE, (b) => {
      const at = 36 + 8 + 1;
      const out = concatBytes(b.slice(0, at), new Uint8Array(32).fill(0xcd), b.slice(at));
      out.set(Uint8Array.of(1), at - 1);
      return out;
    });
    expect(refusedFor(requestOf(CASE, { unsigned_tx: withTable })))
      .toBe('The transaction carries a token table.');
  });

  it('refuses a fee in another token than the native one', () => {
    const otherFee = forge(CASE, (b) => {
      b.set(Uint8Array.of(0), 35);
      return b;
    });
    expect(refusedFor(requestOf(CASE, { unsigned_tx: otherFee })))
      .toBe('The fee is not paid in the native token.');
  });

  it('refuses a list of inputs longer or shorter than the transaction\'s', () => {
    const inputs = inputsOf(CASE);
    for (const list of [[...inputs, inputs[0]], inputs.slice(1)]) {
      expect(refusedFor(requestOf(CASE, { inputs: list })))
        .toBe('The inputs don\'t match the transaction.');
    }
  });

  it('refuses claims the bytes don\'t pay, even when they are what the user approved', () => {
    const more = BigInt(CASE.outputs[PAY_AT].amount) + 1n;
    const context = contextOf(CASE);
    const intent = { ...context.intent, amount: more };
    expect(refusedFor(
      requestOf(CASE, { outputs: claimsWith(PAY_AT, { amount: String(more) }) }),
      { ...context, intent },
    )).toBe(`The outputs don't open: Output ${PAY_AT} doesn't pay what it says.`);
  });

  // The approved payment is there, untouched; what would be the change pays a stranger instead,
  // and is called a payment. Every output opens, the fee is right, the one approved payment is
  // paid: only the count of payments refuses it.
  it('refuses a second payment, to someone the user never approved', () => {
    const stranger = encodeAddress(CASE.pub_a, bytesToHex(publicKeyOf(5n)));
    const second = { ...CHANGE, address: stranger, is_change: false };
    const request = requestOf(CASE, {
      unsigned_tx: forge(CASE, payingTo(CASE, CHANGE_AT, second)),
      outputs: claimsWith(CHANGE_AT, second),
    });
    expect(refusedFor(request)).toBe('The transaction doesn\'t make exactly the user\'s payment.');
  });

  // Nothing is paid to the address approved: every output comes back to this wallet, as change.
  it('refuses a transaction that makes no payment, every output back to this wallet', () => {
    const back = {
      ...CASE.outputs[PAY_AT], address: encodeAddress(CASE.pub_a, CASE.pub_b), is_change: true,
    };
    const request = requestOf(CASE, {
      unsigned_tx: forge(CASE, payingTo(CASE, PAY_AT, back)),
      outputs: claimsWith(PAY_AT, back),
    });
    expect(refusedFor(request)).toBe('The transaction doesn\'t make exactly the user\'s payment.');
  });

  it('refuses change in a token that is neither the payment\'s nor the native one', () => {
    const changed = { ...CHANGE, token: OTHER_TOKEN };
    const request = requestOf(CASE, {
      unsigned_tx: forge(CASE, payingTo(CASE, CHANGE_AT, changed)),
      outputs: claimsWith(CHANGE_AT, changed),
    });
    expect(refusedFor(request)).toBe('A change output is in an unexpected token.');
  });

  it('refuses change to this wallet\'s spend key under another view key', () => {
    const changed = { ...CHANGE, address: encodeAddress(bytesToHex(publicKeyOf(9n)), CASE.pub_b) };
    const request = requestOf(CASE, {
      unsigned_tx: forge(CASE, payingTo(CASE, CHANGE_AT, changed)),
      outputs: claimsWith(CHANGE_AT, changed),
    });
    expect(refusedFor(request)).toBe('A change output pays another wallet.');
  });

  it('refuses, as a refusal, an address it can\'t read', () => {
    const context = contextOf(CASE);
    const intent = { ...context.intent, to: 'not an address' };
    const why = refusal(() => decodeAddressKeys('not an address')).message;
    expect(refusedFor(requestOf(CASE), { ...context, intent }))
      .toBe(`An address can't be read: ${why}`);
  });
});

describe('the sign-once ledger, kept small and true to disk', () => {
  // As the app's store does: the value is in memory before the write to disk ends.
  function storeLike({ failWrites = false } = {}) {
    const memory = {};
    return {
      getItem: (key) => memory[key] ?? null,
      setItemAsync: async (key, value) => {
        memory[key] = value;
        if (failWrites) throw new Error('disk full');
      },
    };
  }

  it('keeps no entry in memory whose write to disk failed', async () => {
    const storage = storeLike({ failWrites: true });
    const context = contextOf(CASE, { ledger: createSignLedger(storage, 'ledger') });
    await expect(verifyAndSign(requestOf(CASE), context)).rejects.toThrow('disk full');
    // Asked again, the same request is not answered with signatures that were never saved.
    expect(context.ledger.entries()).toHaveLength(0);
    expect(storage.getItem('ledger') ?? { entries: [] }).toEqual({ entries: [] });
  });

  it('keeps a settled entry without its signed bytes, still holding what it spent', async () => {
    const context = contextOf(CASE);
    const { txId } = await verifyAndSign(requestOf(CASE), context);
    await context.ledger.markRecorded(txId);
    const [entry] = context.ledger.entries();
    expect(entry).toMatchObject({ txId, recorded: true, outputs: spentOf(CASE) });
    expect(entry).not.toHaveProperty('signedTx');
    expect(entry).not.toHaveProperty('signatures');
    // A recorded transaction is never signed again, and its outputs stay held.
    await expect(verifyAndSign(requestOf(CASE), context))
      .rejects.toThrow('This transaction was already recorded.');
  });

  it('keeps a rejection\'s reason as one short line, whatever words it was given', async () => {
    const context = contextOf(CASE);
    const { txId } = await verifyAndSign(requestOf(CASE), context);
    const newline = String.fromCharCode(10);
    await context.ledger.markRejected(txId, `fee${newline}too low ${'x'.repeat(5000)}`);
    const { reason } = context.ledger.entries()[0];
    expect(reason).toHaveLength(REASON_MAX_LENGTH);
    expect(reason.startsWith('fee too low xxx')).toBe(true);
  });

  it('never lets a failed write take away an entry another write saved', async () => {
    const memory = {};
    let writes = 0;
    const storage = {
      getItem: (key) => memory[key] ?? null,
      setItemAsync: async (key, value) => {
        memory[key] = value;
        writes += 1;
        // The disk refuses the first write, and takes every other.
        if (writes === 1) throw new Error('disk full');
      },
    };
    const ledger = createSignLedger(storage, 'ledger');
    const a = ledger.record({ txId: 'tx-a', sendId: 's-a', outputs: ['1'], signedAt: 1 });
    const b = ledger.record({ txId: 'tx-b', sendId: 's-b', outputs: ['2'], signedAt: 2 });
    await expect(a).rejects.toThrow('disk full');
    await expect(b).resolves.toBeUndefined();
    await new Promise((resolve) => { setTimeout(resolve, 10); });
    // tx-b was saved, and nothing took it away again.
    expect(memory.ledger.entries.map((e) => e.txId)).toEqual(['tx-b']);
  });

  it('gives a transaction\'s signatures again only once its entry is on disk', async () => {
    const memory = {};
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    let writes = 0;
    const storage = {
      getItem: (key) => memory[key] ?? null,
      setItemAsync: async (key, value) => {
        memory[key] = value;
        writes += 1;
        // The first write is slow, and fails; its rollback and every later one are saved.
        if (writes === 1) {
          await held;
          throw new Error('disk full');
        }
      },
    };
    const context = contextOf(CASE, { ledger: createSignLedger(storage, 'ledger') });
    const first = verifyAndSign(requestOf(CASE), context);
    // Asked again while the first write is on its way: the answer waits for that write.
    const second = verifyAndSign(requestOf(CASE), context);
    release();
    await expect(first).rejects.toThrow('disk full');
    const signed = await second;
    // What the second answer gave is on disk.
    expect(memory.ledger.entries)
      .toMatchObject([{ txId: signed.txId, signatures: signed.signatures }]);
  });

  it('holds the outputs of an entry whose write waits behind another, before it is on disk', async () => {
    const memory = {};
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    let writes = 0;
    const storage = {
      getItem: (key) => memory[key] ?? null,
      setItemAsync: async (key, value) => {
        writes += 1;
        // The first write, of another payment, is slow: the next one waits behind it.
        if (writes === 1) await held;
        memory[key] = value;
      },
    };
    const ledger = createSignLedger(storage, 'ledger');
    const other = ledger.record({ txId: 'tx-other', sendId: 's-o', outputs: ['999'], signedAt: 1 });
    const queued = ledger.record({
      txId: 'tx-a', sendId: 's-a', signingHash: 'aa'.repeat(32), outputs: ['5'], signedAt: 2,
    });
    // Neither is on disk yet.
    expect(memory.ledger).toBeUndefined();
    // Another transaction over the same output is refused all the same: the queued entry counts.
    const conflict = refusal(() => ledger.check(new Uint8Array(32), ['5'], [new Uint8Array(32)]));
    expect(conflict).toBeInstanceOf(LedgerConflictError);
    expect(conflict.entry.txId).toBe('tx-a');
    release();
    await Promise.all([other, queued]);
    expect(memory.ledger.entries.map((e) => e.txId)).toEqual(['tx-other', 'tx-a']);
  });

  it('never prunes nor compacts an entry still on its way, however many settle after it', async () => {
    const storage = memoryStorage();
    const ledger = createSignLedger(storage, 'ledger');
    await ledger.record({
      txId: 'tx-pending', sendId: 's-p', outputs: ['1'], signedAt: 0, signedTx: 'cafe',
    });
    for (let i = 0; i < MAX_SETTLED_ENTRIES + 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await ledger.record({
        txId: `tx-${i}`, sendId: `s-${i}`, outputs: [String(1000 + i)], signedAt: i + 1,
      });
      // eslint-disable-next-line no-await-in-loop
      await ledger.markRecorded(`tx-${i}`);
    }
    // The oldest entry of all, and still on its way: kept whole, its bytes ready to go out again.
    expect(ledger.pending()).toMatchObject([{ txId: 'tx-pending', signedTx: 'cafe' }]);
  });

  it('keeps only the newest settled entries', async () => {
    const storage = memoryStorage();
    const ledger = createSignLedger(storage, 'ledger');
    for (let i = 0; i < MAX_SETTLED_ENTRIES + 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await ledger.record({
        txId: `tx-${i}`, sendId: `s-${i}`, outputs: [String(1000 + i)], signedAt: i,
      });
      // eslint-disable-next-line no-await-in-loop
      await ledger.markRecorded(`tx-${i}`);
    }
    const entries = ledger.entries();
    expect(entries).toHaveLength(MAX_SETTLED_ENTRIES);
    expect(entries.map((e) => e.txId)).not.toContain('tx-0');
    expect(entries.map((e) => e.txId)).toContain(`tx-${MAX_SETTLED_ENTRIES + 4}`);
  });
});

// The ledger kept before under another key (connect moves it here): what is still on its way
// keeps holding its outputs, and nothing else comes in.
describe('the sign-once ledger kept before, taken in', () => {
  const pending = (txId, patch = {}) => ({
    txId,
    sendId: `s-${txId}`,
    signingHash: 'aa'.repeat(32),
    outputs: ['7'],
    signedTx: 'cafe',
    signedAt: 5,
    ...patch,
  });

  it('keeps an entry already here as it is: the old ledger\'s copy is not added beside it', async () => {
    const ledger = createSignLedger(memoryStorage(), 'ledger');
    await ledger.record(pending('tx-a'));
    await ledger.markRecorded('tx-a');
    await ledger.adopt([pending('tx-a'), pending('tx-b', { outputs: ['8'] })]);
    expect(ledger.entries().map((e) => e.txId)).toEqual(['tx-a', 'tx-b']);
    // The recorded one is still recorded, and nothing of it is on its way again.
    expect(ledger.pending().map((e) => e.txId)).toEqual(['tx-b']);
  });

  it('takes in nothing that is not an entry: no id, an id that is no text, nothing at all', async () => {
    const ledger = createSignLedger(memoryStorage(), 'ledger');
    await ledger.adopt([null, undefined, {}, { txId: 5, outputs: ['9'] }, { sendId: 's' }]);
    expect(ledger.entries()).toEqual([]);
    // And signing still works after it.
    expect(ledger.check(new Uint8Array(32), ['9'], [new Uint8Array(32)])).toBeNull();
  });

  it('takes in only what is still on its way', async () => {
    const ledger = createSignLedger(memoryStorage(), 'ledger');
    await ledger.adopt([
      pending('tx-rec', { recorded: true }),
      pending('tx-rej', { rejected: true }),
      pending('tx-go', { outputs: ['8'] }),
    ]);
    expect(ledger.entries().map((e) => e.txId)).toEqual(['tx-go']);
  });
});

describe('shapes the network refuses, refused before signing', () => {
  it('refuses a transaction that spends one output twice', () => {
    const twice = forge(CASE, (b) => {
      const tx = parseTx(b);
      const inputsOff = 36 + (tx.width === 'u128' ? 16 : 8) + 1 + 32 * tx.table.length;
      b.set(b.slice(inputsOff, inputsOff + 8), inputsOff + 72);
      return b;
    });
    const tx = parseTx(hexToBytes(twice));
    const inputs = inputsOf(CASE).map((input, i) => ({
      ...input, global_index: Number(tx.inputs[i].outputIndex),
    }));
    expect(refusedFor(requestOf(CASE, { unsigned_tx: twice, inputs })))
      .toBe('The transaction spends an output twice.');
  });

  it('refuses an amount width other than the network\'s', () => {
    expect(refusedFor(requestOf(CASE), contextOf(CASE, { amountWidth: 'u128' })))
      .toBe('The transaction\'s amounts are u64; this network takes u128.');
  });

  it('refuses an input offset that is not a canonical scalar', () => {
    const inputs = inputsOf(CASE).map((input, i) => (i === 0
      ? {
        ...input,
        otk_offset: bytesToHex(bigintToBytesLE(
          bytesToBigintLE(hexToBytes(input.otk_offset)) + ORDER,
        )),
      }
      : input));
    expect(refusedFor(requestOf(CASE, { inputs })))
      .toBe('An input\'s offset is not a canonical scalar.');
  });

  // The order encodes zero in a form no honest backend writes. An input whose offset is zero pays
  // the spend key itself (a declared coin): seen from a wallet whose spend secret is the first
  // input's one-time secret, the vector's first input is one, and the second keeps its key.
  it('refuses the group order as an offset, the one non-canonical zero', () => {
    const b = bytesToBigintLE(hexToBytes(CASE.b));
    const offsets = CASE.inputs.map((i) => bytesToBigintLE(hexToBytes(i.otk_offset)));
    const context = contextOf(CASE, { b: modOrder(offsets[0] + b) });
    const inputsWith = (zero) => inputsOf(CASE).map((input, i) => ({
      ...input,
      otk_offset: i === 0 ? zero : bytesToHex(bigintToBytesLE(modOrder(offsets[i] - offsets[0]))),
    }));
    // With a canonical zero the same request passes: only the encoding is wrong.
    expect(refusal(() => checkSignRequest(
      requestOf(CASE, { inputs: inputsWith('00'.repeat(32)) }),
      context,
    ))).toBeNull();
    expect(refusedFor(
      requestOf(CASE, { inputs: inputsWith(bytesToHex(bigintToBytesLE(ORDER))) }),
      context,
    )).toBe('An input\'s offset is not a canonical scalar.');
  });

  it('refuses an input offset written in other than its 32 bytes', () => {
    // A zero byte more names the same scalar, in a form no honest backend writes.
    const inputs = inputsOf(CASE).map((input, i) => (i === 0
      ? { ...input, otk_offset: `${input.otk_offset}00` }
      : input));
    expect(refusedFor(requestOf(CASE, { inputs })))
      .toBe('An input\'s offset is not a canonical scalar.');
  });

  // The transaction's key in another form than its 32 canonical bytes names the same scalar.
  describe.each([CASE, V3])('the opening of "$name"', (vector) => {
    const r = bytesToBigintLE(hexToBytes(vector.sender_opening));

    it('is refused written with a zero byte more', () => {
      expect(refusedFor(
        requestOf(vector, { sender_opening: `${vector.sender_opening}00` }),
        contextOf(vector),
      )).toBe('The outputs don\'t open: A scalar is 32 bytes.');
    });

    it('is refused written as the scalar plus the group order', () => {
      expect(refusedFor(
        requestOf(vector, { sender_opening: bytesToHex(bigintToBytesLE(r + ORDER)) }),
        contextOf(vector),
      )).toBe('The outputs don\'t open: Not a canonical scalar.');
    });
  });

  it('refuses a v3 transaction whose excess is the identity', () => {
    const bytes = hexToBytes(V3.unsigned_tx);
    const tx = parseTx(bytes);
    bytes.set(new Uint8Array(32), tx.sections.coreLen - 32);
    // An identity excess "signs" with s = k: s·G = R + e·0.
    const k = 4242n;
    const msg = signingHashOf(bytes, parseTx(bytes));
    bytes.set(concatBytes(publicKeyOf(k), bigintToBytesLE(k)), tx.excess.signatureOffset);
    expect(refusedFor(requestOf(V3, { unsigned_tx: bytesToHex(bytes) }), contextOf(V3)))
      .toBe('The transaction\'s excess is the identity.');
    expect(msg).toHaveLength(32);
  });
});
