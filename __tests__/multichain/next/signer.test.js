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
  verifyAndSign,
} from '../../../src/multichain/next/signer';
import { EXCESS_DOMAIN, INPUT_DOMAIN, verifyIn } from '../../../src/multichain/next/kit/inputSig';
import { hashToScalar } from '../../../src/multichain/next/kit/hash';
import { expectedOutput } from '../../../src/multichain/next/kit/opening';
import {
  parseTx,
  signingHashOf,
  spentOutputsOfBytes,
  txIdOf,
} from '../../../src/multichain/next/kit/tx';
import { encodeAddress } from '../../../src/multichain/next/kit/address';
import { publicKeyOf } from '../../../src/multichain/next/kit/keys';
import {
  bigintToBytesLE,
  bytesToBigintLE,
  bytesToHex,
  concatBytes,
  hexToBytes,
  modOrder,
  scalarFromCanonical,
} from '../../../src/multichain/next/kit/scalar';

const [CASE] = vectors.cases;
const NATIVE = vectors.native_token;

// What an honest backend sends: each input with the output index the transaction spends there.
const inputsOf = (vector) => {
  const tx = parseTx(hexToBytes(vector.unsigned_tx));
  return vector.inputs.map((input, i) => ({
    ...input,
    global_index: Number(tx.inputs[i].outputIndex),
  }));
};

// The outputs a vector's inputs spend, as the ledger names them.
const spentOf = (vector) => inputsOf(vector).map((input) => String(input.global_index));

function requestOf(vector, patch = {}) {
  return {
    id: 'send-1',
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

function memoryStorage({ failWrites = false } = {}) {
  const data = {};
  return {
    getItem: (key) => (key in data ? JSON.parse(data[key]) : null),
    setItemAsync: async (key, value) => {
      if (failWrites) throw new Error('disk full');
      data[key] = JSON.stringify(value);
    },
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
    ledger: createSignLedger(memoryStorage(), 'ledger'),
    ...overrides,
  };
}

const refusal = (fn) => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
};

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

  it('refuses a payment to someone else, of another amount, or in another token', () => {
    const other = encodeAddress(CASE.pub_a, bytesToHex(publicKeyOf(5n)));
    const intents = [
      { ...context.intent, to: other },
      { ...context.intent, amount: context.intent.amount + 1n },
      { ...context.intent, tokenId: 'ab'.repeat(32) },
    ];
    const refusals = intents.map((intent) => (
      refusal(() => checkSignRequest(requestOf(CASE), { ...context, intent }))
    ));
    refusals.forEach((e) => expect(e).toBeInstanceOf(SignRefusedError));
  });

  it('refuses a payment the backend calls change', () => {
    const outputs = CASE.outputs.map((o) => ({ ...o, is_change: true }));
    expect(refusal(() => checkSignRequest(requestOf(CASE, { outputs }), context)))
      .toBeInstanceOf(SignRefusedError);
  });

  it('refuses outputs that the bytes do not pay', () => {
    const outputs = CASE.outputs.map((o, i) => (
      i === 0 ? { ...o, amount: String(BigInt(o.amount) - 1n) } : o
    ));
    expect(refusal(() => checkSignRequest(requestOf(CASE, { outputs }), context)))
      .toBeInstanceOf(SignRefusedError);
  });

  it('refuses a fee above what the user agreed to, or not the one in the bytes', () => {
    const cheaper = { ...context, maxFee: BigInt(CASE.fee) - 1n };
    expect(refusal(() => checkSignRequest(requestOf(CASE), cheaper)))
      .toBeInstanceOf(SignRefusedError);
    expect(refusal(() => checkSignRequest(requestOf(CASE, { fee: '1' }), context)))
      .toBeInstanceOf(SignRefusedError);
  });

  it('refuses an input that is not this wallet\'s', () => {
    const inputs = inputsOf(CASE).map((i, k) => (
      k === 0 ? { ...i, otk_offset: '01'.padEnd(64, '0') } : i
    ));
    expect(refusal(() => checkSignRequest(requestOf(CASE, { inputs }), context)))
      .toBeInstanceOf(SignRefusedError);
    const stranger = contextOf(CASE, { b: 12345n });
    expect(refusal(() => checkSignRequest(requestOf(CASE), stranger)))
      .toBeInstanceOf(SignRefusedError);
  });

  it('refuses a broken excess signature or unreadable bytes', () => {
    const bytes = hexToBytes(CASE.unsigned_tx);
    bytes[bytes.length - 1] = bytes[bytes.length - 1] === 0 ? 1 : 0;
    const broken = requestOf(CASE, { unsigned_tx: bytesToHex(bytes) });
    expect(refusal(() => checkSignRequest(broken, context))).toBeInstanceOf(SignRefusedError);
    expect(refusal(() => checkSignRequest(requestOf(CASE, { unsigned_tx: 'zz' }), context)))
      .toBeInstanceOf(SignRefusedError);
  });

  it('never signs an input into two transactions, and repeats the same signatures for the same one', async () => {
    const first = await verifyAndSign(requestOf(CASE), context);
    const again = await verifyAndSign(requestOf(CASE, { id: 'send-2' }), context);
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
    const context = contextOf(vector, { wireFormat: other });
    expect(refusal(() => checkSignRequest(requestOf(vector), context)))
      .toBeInstanceOf(SignRefusedError);
  });
});

// Every refused case verifies once signed: the network would take it. The amount leak is the
// one this signer does not refuse: it needs the wallet's own record of which outputs it holds are
// public, and the app keeps none. Counting every input as public instead would refuse a token
// payment whose native change is the only native output.
const SIGNER_REFUSES = ['fee', 'output', 'input'];

describe.each(vectors.refused_cases.filter((r) => SIGNER_REFUSES.includes(r.refusal)))(
  'the refused case "$case.name"',
  ({ case: vector }) => {
    it('is refused', () => {
      expect(refusal(() => checkSignRequest(requestOf(vector), contextOf(vector))))
        .toBeInstanceOf(SignRefusedError);
    });
  },
);

test('the refused cases are the ones this signer knows of', () => {
  expect(vectors.refused_cases.map((r) => r.refusal).sort())
    .toEqual([...SIGNER_REFUSES, 'amount leak'].sort());
});

describe('what the sign-once ledger and the inputs guard', () => {
  it('refuses inputs that are not the outputs the transaction spends', () => {
    const context = contextOf(CASE);
    const shifted = inputsOf(CASE).map((i) => ({ ...i, global_index: i.global_index + 1 }));
    const missing = CASE.inputs;
    for (const inputs of [shifted, missing]) {
      expect(refusal(() => checkSignRequest(requestOf(CASE, { inputs }), context)))
        .toBeInstanceOf(SignRefusedError);
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

  it('refuses a request past its time, or with none', () => {
    const context = contextOf(CASE, { nowS: 1788000000 });
    for (const expiresAt of [1788000000, 1787999999, undefined, '4000000000']) {
      expect(refusal(() => checkSignRequest(requestOf(CASE, { expires_at: expiresAt }), context)))
        .toBeInstanceOf(SignRefusedError);
    }
    expect(refusal(() => checkSignRequest(requestOf(CASE, { expires_at: 1788000001 }), context)))
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

// A transaction as a dishonest backend could build it: the vector's bytes changed by `change`, the
// excess re-signed with a key the test holds. The app checks the excess signature, not that the
// amounts balance (the network does), so such a transaction fails only the check under test.
const FORGER = 777n;
function forge(vector, change) {
  const bytes = change(hexToBytes(vector.unsigned_tx));
  const point = publicKeyOf(FORGER);
  bytes.set(point, parseTx(bytes).excess.signatureOffset - 32);
  const tx = parseTx(bytes);
  const msg = signingHashOf(bytes, tx);
  const k = 4242n;
  const r = publicKeyOf(k);
  const e = hashToScalar(EXCESS_DOMAIN, [point, r, msg]);
  bytes.set(concatBytes(r, bigintToBytesLE(modOrder(k + e * FORGER))), tx.excess.signatureOffset);
  return bytesToHex(bytes);
}

// Output `j` of a v2 transaction rewritten to pay `amount` of `token` to `address`, as the
// vector's sender would have written it. The layout is kit/txV2.js's.
function payingTo(vector, j, { address, token, amount }) {
  return (bytes) => {
    const tx = parseTx(bytes);
    const u128 = tx.width === 'u128';
    const points = u128 ? 5 : 4;
    const linkLen = u128 ? 256 : 160;
    const memoLen = u128 ? 16 : 8;
    const surjectionLen = 36 + 32 * tx.nIn;
    const outputLen = 32 * points + linkLen + surjectionLen + 1 + memoLen;
    const inputsOff = 36 + (u128 ? 16 : 8) + 1 + 32 * tx.table.length;
    const o = inputsOff + tx.nIn * (8 + 64) + j * outputLen;
    const tagOff = o + 32 * points + linkLen + surjectionLen;
    const r = scalarFromCanonical(hexToBytes(vector.sender_opening));
    const want = expectedOutput(r, address, hexToBytes(token), BigInt(amount), j, memoLen);
    bytes.set(want.oneTimeKey, o);
    bytes.set(want.assetTag, o + 32);
    bytes.set(want.commitment, o + 64);
    bytes.set(Uint8Array.of(want.viewTag), tagOff);
    bytes.set(want.memo, tagOff + 1);
    return bytes;
  };
}

// Each check on its own: every request below breaks only what one check guards, and the refusal
// must name that check, so no other check can stand in for it.
describe('each check of a payment, on its own', () => {
  const CHANGE_AT = CASE.outputs.findIndex((o) => o.is_change);
  const CHANGE = CASE.outputs[CHANGE_AT];
  const OTHER_TOKEN = 'cd'.repeat(32);
  const refusedFor = (request, context = contextOf(CASE)) => {
    const e = refusal(() => checkSignRequest(request, context));
    expect(e).toBeInstanceOf(SignRefusedError);
    return e.message;
  };
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
    const payAt = CASE.outputs.findIndex((o) => !o.is_change);
    const more = BigInt(CASE.outputs[payAt].amount) + 1n;
    const context = contextOf(CASE);
    const intent = { ...context.intent, amount: more };
    expect(refusedFor(
      requestOf(CASE, { outputs: claimsWith(payAt, { amount: String(more) }) }),
      { ...context, intent },
    )).toMatch(/^The outputs don't open/);
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
    expect(refusedFor(requestOf(CASE), { ...context, intent }))
      .toMatch(/^An address can't be read/);
  });
});
