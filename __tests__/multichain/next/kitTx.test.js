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
import { parseTxV2 } from '../../../src/multichain/next/kit/txV2';
import { parseTxV3 } from '../../../src/multichain/next/kit/txV3';
import {
  EXCESS_DOMAIN,
  INPUT_DOMAIN,
  signInput,
  verifyIn,
} from '../../../src/multichain/next/kit/inputSig';
import { checkOpening } from '../../../src/multichain/next/kit/opening';
import { publicKeyOf } from '../../../src/multichain/next/kit/keys';
import {
  bytesToBigintLE,
  bytesToHex,
  hexToBytes,
  modOrder,
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

  it('refuses any other shape or length', () => {
    expect(() => parseTxV2(changed(bytes, 0, 0x12))).toThrow();
    expect(() => parseTxV2(bytes.slice(0, bytes.length - 1))).toThrow();
    expect(() => parseTxV2(Uint8Array.from([...bytes, 0]))).toThrow();
    expect(() => parseTx(changed(bytes, 0, 0x12))).toThrow();
  });

  it('reads v3 only as a plain transfer of shielded outputs, with an excess', () => {
    expect(parseTxV3(v3).format).toBe('v3');
    // The ring family, a set flag (fully transparent, or a mint), another kind.
    expect(() => parseTx(changed(v3, 0, 0x42))).toThrow();
    expect(() => parseTx(changed(v3, 1, 1))).toThrow();
    expect(() => parseTx(changed(v3, 1, 2))).toThrow();
    expect(() => parseTx(changed(v3, 2, 1))).toThrow();
    // Amount-shielded or transparent outputs.
    expect(() => parseTx(changed(v3, 5, 1))).toThrow();
    expect(() => parseTx(changed(v3, 6, 1))).toThrow();
    expect(() => parseTx(v3.slice(0, v3.length - 1))).toThrow();
    expect(() => parseTx(Uint8Array.from([...v3, 0]))).toThrow();
    // Each format's reader takes only its own.
    expect(() => parseTxV2(v3)).toThrow();
    expect(() => parseTxV3(bytes)).toThrow();
  });

  it('knows the native token only by its index', () => {
    expect(parseTx(bytes).feeTokenIndex).toBe(255);
    expect(parseTx(v3).feeTokenIndex).toBe(255);
    expect(NATIVE).toHaveLength(32);
  });
});
