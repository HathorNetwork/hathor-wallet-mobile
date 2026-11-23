/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from '@jest/globals';
import vectors from './fixtures/remote-signing.json';
import {
  parseTx,
  signingHashOf,
  txIdOf,
  withInputSignatures,
} from '../../../src/multichain/next/kit/tx';
import {
  MAX_INPUTS,
  MAX_OUTPUTS,
  MAX_TOKEN_TABLE,
  SIG_LEN,
  parseTxV2,
  rangeProofLen,
} from '../../../src/multichain/next/kit/txV2';
import { parseTxV3 } from '../../../src/multichain/next/kit/txV3';
import {
  EXCESS_DOMAIN,
  INPUT_DOMAIN,
  signInput,
  verifyIn,
} from '../../../src/multichain/next/kit/inputSig';
import { checkOpening, expectedOutput } from '../../../src/multichain/next/kit/opening';
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

// The vectors are written by hathor-next's crates/samba-wallet-sdk/tests/remote_signing.rs from
// transactions its real builder made and its real verifier accepted.

const NATIVE = hexToBytes(vectors.native_token);
const recipientsOf = (vector) => vector.outputs.map((o) => ({
  address: o.address,
  amount: BigInt(o.amount),
  tokenId: hexToBytes(o.token),
}));

describe.each(vectors.cases)('the remote-signing case "$name"', (vector) => {
  const bytes = hexToBytes(vector.unsigned_tx);
  const tx = parseTx(bytes);

  it('reads the transaction and recomputes its signing hash', () => {
    expect(tx.format).toBe(vector.format);
    expect(tx.nIn).toBe(vector.inputs.length);
    expect(tx.nOut).toBe(vector.outputs.length);
    expect(tx.feeAmount).toBe(BigInt(vector.fee));
    expect(bytesToHex(signingHashOf(bytes, tx))).toBe(vector.signing_hash);
    // The signing hash zeroes (v2) or leaves out (v3) every signature: the signed bytes give the
    // same one.
    const signed = hexToBytes(vector.signed_tx);
    expect(bytesToHex(signingHashOf(signed, parseTx(signed)))).toBe(vector.signing_hash);
  });

  it('verifies the excess signature', () => {
    const msg = hexToBytes(vector.signing_hash);
    expect(verifyIn(EXCESS_DOMAIN, tx.excess.point, msg, tx.excess.signature)).toBe(true);
    expect(verifyIn(INPUT_DOMAIN, tx.excess.point, msg, tx.excess.signature)).toBe(false);
  });

  it('opens every output with the sender opening', () => {
    expect(() => checkOpening(tx, recipientsOf(vector), hexToBytes(vector.sender_opening)))
      .not.toThrow();
  });

  it('refuses outputs that pay anything else', () => {
    const opening = hexToBytes(vector.sender_opening);
    const swapped = recipientsOf(vector);
    [swapped[0].address, swapped[1].address] = [swapped[1].address, swapped[0].address];
    expect(() => checkOpening(tx, swapped, opening)).toThrow();

    const more = recipientsOf(vector);
    more[0].amount += 1n;
    expect(() => checkOpening(tx, more, opening)).toThrow();

    const otherToken = recipientsOf(vector);
    otherToken[0].tokenId = new Uint8Array(32).fill(7);
    expect(() => checkOpening(tx, otherToken, opening)).toThrow();

    expect(() => checkOpening(tx, recipientsOf(vector).slice(1), opening)).toThrow();
    const wrongKey = Uint8Array.from(opening);
    wrongKey[0] = wrongKey[0] === 0 ? 1 : 0;
    expect(() => checkOpening(tx, recipientsOf(vector), wrongKey)).toThrow();
  });

  // Each check on its own: the refusal must name the check, so no other one can stand in for it.
  describe('each check of the opening, on its own', () => {
    const opening = hexToBytes(vector.sender_opening);
    const open = (recipients, key = opening, parsed = tx) => (
      () => checkOpening(parsed, recipients ?? recipientsOf(vector), key)
    );
    const changed = (field) => {
      const out = Uint8Array.from(field);
      out[0] = (out[0] + 1) % 256;
      return out;
    };

    it('needs exactly one recipient per output', () => {
      const all = recipientsOf(vector);
      expect(open([...all, all[0]])).toThrow('Every output needs a recipient.');
      expect(open(all.slice(1))).toThrow('Every output needs a recipient.');
    });

    it('needs the transaction\'s own key, never zero', () => {
      const next = bigintToBytesLE(modOrder(bytesToBigintLE(opening) + 1n));
      for (const key of [new Uint8Array(32), next]) {
        expect(open(undefined, key)).toThrow('The opening is not this transaction\'s key.');
      }
    });

    it('never opens with a zero key, even a transaction whose key is the identity', () => {
      // With r = 0 every shared secret is the identity: anyone could open the outputs.
      const recipients = recipientsOf(vector);
      const memoLen = tx.width === 'u64' ? 8 : 16;
      const outputs = recipients.map((rc, index) => (
        expectedOutput(0n, rc.address, rc.tokenId, rc.amount, index, memoLen)
      ));
      const identityKeyed = { ...tx, rPub: new Uint8Array(32), outputs };
      expect(open(recipients, new Uint8Array(32), identityKeyed))
        .toThrow('The opening is not this transaction\'s key.');
    });

    it('refuses an amount out of range for the width, whose commitment could alias', () => {
      const max = tx.width === 'u64' ? 2n ** 64n - 1n : 2n ** 128n - 1n;
      for (const amount of [-1n, max + 1n]) {
        const recipients = recipientsOf(vector);
        recipients[0].amount = amount;
        expect(open(recipients)).toThrow('Output 0 pays an amount out of range.');
      }
    });

    it.each(['oneTimeKey', 'viewTag', 'assetTag', 'commitment', 'memo'])(
      'refuses an output whose %s is not the one its recipient gets',
      (field) => {
        const outputs = tx.outputs.map((o) => ({ ...o }));
        outputs[0][field] = field === 'viewTag'
          ? (outputs[0].viewTag + 1) % 256
          : changed(outputs[0][field]);
        expect(open(undefined, opening, { ...tx, outputs }))
          .toThrow('Output 0 doesn\'t pay what it says.');
      },
    );
  });

  it('verifies the signer\'s signatures and assembles the signed transaction and its id', () => {
    const msg = hexToBytes(vector.signing_hash);
    vector.inputs.forEach((input, i) => {
      const key = hexToBytes(input.one_time_key);
      expect(verifyIn(INPUT_DOMAIN, key, msg, hexToBytes(vector.signatures[i]))).toBe(true);
    });
    const signed = withInputSignatures(bytes, tx, vector.signatures.map(hexToBytes));
    expect(bytesToHex(signed)).toBe(vector.signed_tx);
    expect(bytesToHex(txIdOf(signed))).toBe(vector.tx_id);
  });

  it('puts in exactly one signature per input, of 64 bytes each', () => {
    const sigs = vector.signatures.map(hexToBytes);
    expect(() => withInputSignatures(bytes, tx, sigs.slice(1))).toThrow('One signature per input.');
    expect(() => withInputSignatures(bytes, tx, [...sigs, sigs[0]]))
      .toThrow('One signature per input.');
    const short = [sigs[0].slice(0, SIG_LEN - 1), ...sigs.slice(1)];
    expect(() => withInputSignatures(bytes, tx, short)).toThrow('A signature is 64 bytes.');
  });

  it('signs each input with otk_offset + b, so its key verifies the signature', () => {
    const b = bytesToBigintLE(hexToBytes(vector.b));
    const msg = hexToBytes(vector.signing_hash);
    vector.inputs.forEach((input) => {
      const p = modOrder(bytesToBigintLE(hexToBytes(input.otk_offset)) + b);
      const key = hexToBytes(input.one_time_key);
      expect(bytesToHex(publicKeyOf(p))).toBe(input.one_time_key);
      const sig = signInput(p, key, msg);
      expect(verifyIn(INPUT_DOMAIN, key, msg, sig)).toBe(true);
      expect(verifyIn(INPUT_DOMAIN, key, new Uint8Array(32), sig)).toBe(false);
    });
  });
});

describe('the transaction reader', () => {
  const bytes = hexToBytes(vectors.cases.find((c) => c.format === 'v2').unsigned_tx);
  const v3 = hexToBytes(vectors.cases.find((c) => c.format === 'v3').unsigned_tx);
  const changed = (from, at, value) => {
    const out = Uint8Array.from(from);
    out[at] = value;
    return out;
  };
  const SHAPE = 'Not a transaction this wallet signs.';
  const SHORT = 'The transaction is not as long as its header says.';

  it('refuses any other shape or length', () => {
    expect(() => parseTxV2(changed(bytes, 0, 0x12))).toThrow(SHAPE);
    expect(() => parseTxV2(bytes.slice(0, bytes.length - 1))).toThrow(SHORT);
    expect(() => parseTxV2(Uint8Array.from([...bytes, 0]))).toThrow(SHORT);
    expect(() => parseTx(changed(bytes, 0, 0x12))).toThrow(SHAPE);
  });

  it('reads v3 only as a plain transfer of shielded outputs, with an excess', () => {
    expect(parseTxV3(v3).format).toBe('v3');
    // The ring family.
    expect(() => parseTx(changed(v3, 0, 0x42))).toThrow(SHAPE);
    // A set flag: fully transparent, a mint, an unknown one.
    for (const flags of [1, 2, 4]) {
      expect(() => parseTx(changed(v3, 1, flags))).toThrow(SHAPE);
    }
    // Another kind: a token creation, a mint, a melt, an unknown one.
    for (const kind of [1, 2, 3, 9]) {
      expect(() => parseTx(changed(v3, 2, kind))).toThrow(SHAPE);
    }
    // Amount-shielded or transparent outputs.
    const outputs = 'The transaction has outputs this wallet does not sign.';
    expect(() => parseTx(changed(v3, 5, 1))).toThrow(outputs);
    expect(() => parseTx(changed(v3, 6, 1))).toThrow(outputs);
    expect(() => parseTx(v3.slice(0, v3.length - 1))).toThrow(SHORT);
    expect(() => parseTx(Uint8Array.from([...v3, 0]))).toThrow(SHORT);
    // Each format's reader takes only its own.
    expect(() => parseTxV2(v3)).toThrow(SHAPE);
    expect(() => parseTxV3(bytes)).toThrow(SHAPE);
  });

  // A u64 payment written section by section, as long as its counts say: every field the reader
  // doesn't check is zeros, so each case below fails only on the count it changes.
  describe.each(['v2', 'v3'])('of a %s payment written by the test', (format) => {
    const written = ({ nIn = 2, nOut = 2, table = 0 }) => {
      const head = [Uint8Array.of(255), new Uint8Array(8), Uint8Array.of(table)];
      const tableBytes = new Uint8Array(32 * table);
      const surjections = (36 + 32 * nIn) * nOut;
      const range = nOut > 0 ? rangeProofLen(false, nOut) : 0;
      if (format === 'v2') {
        // header ‖ r_pub ‖ fee ‖ table ‖ inputs ‖ outputs ‖ range proof ‖ excess
        const output = 32 * 4 + 160 + (36 + 32 * nIn) + 1 + 8;
        return concatBytes(
          Uint8Array.of(0x1a, nIn, nOut),
          new Uint8Array(32),
          ...head,
          tableBytes,
          new Uint8Array((8 + SIG_LEN) * nIn + output * nOut),
          new Uint8Array(rangeProofLen(false, nOut)),
          new Uint8Array(32 + 64),
        );
      }
      // core: header ‖ r_pub ‖ fee ‖ table ‖ inputs ‖ shielded outputs ‖ excess point; then the
      // witness: signatures ‖ links ‖ surjections ‖ range proof ‖ excess signature
      return concatBytes(
        Uint8Array.of(0x40, 0, 0, nIn, nOut, 0, 0),
        new Uint8Array(32),
        ...head,
        tableBytes,
        new Uint8Array(8 * nIn + (32 * 4 + 1 + 8) * nOut + 32),
        new Uint8Array(SIG_LEN * nIn + 160 * nOut + surjections + range + 64),
      );
    };
    const COUNTS = 'The transaction has too few or too many inputs or outputs.';

    it('reads every count the protocol allows, up to its 16 inputs, outputs and tokens', () => {
      expect([MAX_INPUTS, MAX_OUTPUTS, MAX_TOKEN_TABLE]).toEqual([16, 16, 16]);
      for (const counts of [{}, { nIn: 1, nOut: 1 }, { nIn: MAX_INPUTS, nOut: MAX_OUTPUTS }]) {
        const tx = parseTx(written(counts));
        expect([tx.format, tx.nIn, tx.nOut]).toEqual([format, counts.nIn ?? 2, counts.nOut ?? 2]);
      }
      expect(parseTx(written({ table: MAX_TOKEN_TABLE })).table).toHaveLength(MAX_TOKEN_TABLE);
    });

    it.each([
      ['no input', { nIn: 0 }],
      ['more inputs than a transaction holds', { nIn: MAX_INPUTS + 1 }],
      ['no output', { nOut: 0 }],
      ['more outputs than a transaction holds', { nOut: MAX_OUTPUTS + 1 }],
    ])('refuses %s', (name, counts) => {
      expect(() => parseTx(written(counts))).toThrow(COUNTS);
    });

    it('refuses a token table longer than a transaction holds', () => {
      expect(() => parseTx(written({ table: MAX_TOKEN_TABLE + 1 })))
        .toThrow('The transaction names too many tokens.');
    });
  });

  it('knows the native token only by its index', () => {
    expect(parseTx(bytes).feeTokenIndex).toBe(255);
    expect(parseTx(v3).feeTokenIndex).toBe(255);
    expect(NATIVE).toHaveLength(32);
  });
});

describe('an input\'s signature', () => {
  const msg = new Uint8Array(32).fill(7);
  const p = 1234567n;
  const key = publicKeyOf(p);

  it('is never made with a zero secret', () => {
    expect(() => signInput(0n, key, msg)).toThrow('Could not sign.');
  });

  it('verifies only at 64 bytes, with s below the group order', () => {
    const sig = signInput(p, key, msg);
    expect(verifyIn(INPUT_DOMAIN, key, msg, sig)).toBe(true);
    // The same R and s, a zero byte more.
    expect(verifyIn(INPUT_DOMAIN, key, msg, concatBytes(sig, Uint8Array.of(0)))).toBe(false);
    // s + ℓ names the same scalar.
    const s = bytesToBigintLE(sig.slice(32));
    const aliased = concatBytes(sig.slice(0, 32), bigintToBytesLE(s + ORDER));
    expect(verifyIn(INPUT_DOMAIN, key, msg, aliased)).toBe(false);
  });

  // A nonce that left any of the three out would repeat, or be anyone's to compute, with a weak
  // random source: two signatures sharing a nonce give the secret away.
  it('takes its nonce from the secret, the message and the randomness', () => {
    const entropy = new Uint8Array(32).fill(9);
    const nonceOf = (...args) => bytesToHex(signInput(...args).slice(0, 32));
    const base = nonceOf(p, key, msg, entropy);
    expect(nonceOf(p, key, new Uint8Array(32).fill(8), entropy)).not.toBe(base);
    expect(nonceOf(p + 1n, key, msg, entropy)).not.toBe(base);
    expect(nonceOf(p, key, msg, new Uint8Array(32).fill(10))).not.toBe(base);
    expect(nonceOf(p, key, msg, entropy)).toBe(base);
  });
});
