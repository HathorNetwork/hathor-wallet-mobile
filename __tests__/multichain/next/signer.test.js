/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { beforeEach, describe, it, expect } from '@jest/globals';
import vectors from './fixtures/remote-signing.json';
import {
  LedgerConflictError,
  SignRefusedError,
  checkSignRequest,
  createSignLedger,
  verifyAndSign,
} from '../../../src/multichain/next/signer';
import { INPUT_DOMAIN, verifyIn } from '../../../src/multichain/next/kit/inputSig';
import { parseTxV2, signingHashOf, txIdOf } from '../../../src/multichain/next/kit/txV2';
import { encodeAddress } from '../../../src/multichain/next/kit/address';
import { publicKeyOf } from '../../../src/multichain/next/kit/keys';
import { bytesToBigintLE, bytesToHex, hexToBytes } from '../../../src/multichain/next/kit/scalar';

const [CASE] = vectors.cases;
const NATIVE = vectors.native_token;

// What an honest backend sends: each input with the output index the transaction spends there.
const inputsOf = (vector) => {
  const tx = parseTxV2(hexToBytes(vector.unsigned_tx));
  return vector.inputs.map((input, i) => ({
    ...input,
    global_index: Number(tx.inputs[i].outputIndex),
  }));
};

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

function contextOf(vector, overrides = {}) {
  const payment = vector.outputs.find((o) => !o.is_change);
  return {
    b: bytesToBigintLE(hexToBytes(vector.b)),
    pubB: hexToBytes(vector.pub_b),
    intent: { to: payment.address, amount: BigInt(payment.amount), tokenId: payment.token },
    nativeTokenId: NATIVE,
    serviceViewPub: vector.pub_a,
    maxFee: BigInt(vector.fee),
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
    const hash = signingHashOf(unsigned, parseTxV2(unsigned));
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
    const tx = parseTxV2(bytes);
    const fakeHash = signingHashOf(bytes, tx);
    fakeHash[0] = fakeHash[0] === 0 ? 1 : 0;
    const inputKeys = CASE.inputs.map((i) => hexToBytes(i.one_time_key));
    const conflict = refusal(() => context.ledger.check(fakeHash, inputKeys));
    expect(conflict).toBeInstanceOf(LedgerConflictError);
    expect(conflict.entry.txId).toBe(first.txId);
  });
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
    const otherHash = signingHashOf(bytes, parseTxV2(bytes));
    otherHash[0] = otherHash[0] === 0 ? 1 : 0;
    const inputKeys = CASE.inputs.map((i) => hexToBytes(i.one_time_key));
    expect(refusal(() => context.ledger.check(otherHash, inputKeys)))
      .toBeInstanceOf(LedgerConflictError);

    await context.ledger.markRejected(txId, 'fee too low');
    expect(context.ledger.check(otherHash, inputKeys)).toBeNull();
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
