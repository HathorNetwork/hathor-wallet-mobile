/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from '@jest/globals';
import vectors from './fixtures/remote-signing.json';
import {
  parseTxV2,
  signingHashOf,
  txIdOf,
  withInputSignatures,
} from '../../../src/multichain/next/kit/txV2';
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
  const tx = parseTxV2(bytes);

  it('reads the transaction and recomputes its signing hash', () => {
    expect(tx.nIn).toBe(vector.inputs.length);
    expect(tx.nOut).toBe(vector.outputs.length);
    expect(tx.feeAmount).toBe(BigInt(vector.fee));
    expect(bytesToHex(signingHashOf(bytes, tx))).toBe(vector.signing_hash);
    // The signing hash zeroes every signature: the signed bytes give the same one.
    const signed = hexToBytes(vector.signed_tx);
    expect(bytesToHex(signingHashOf(signed, parseTxV2(signed)))).toBe(vector.signing_hash);
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
  const bytes = hexToBytes(vectors.cases[0].unsigned_tx);

  it('refuses any other shape or length', () => {
    const otherShape = Uint8Array.from(bytes);
    otherShape[0] = 0x12;
    expect(() => parseTxV2(otherShape)).toThrow();
    expect(() => parseTxV2(bytes.slice(0, bytes.length - 1))).toThrow();
    expect(() => parseTxV2(Uint8Array.from([...bytes, 0]))).toThrow();
  });

  it('knows the native token only by its index', () => {
    expect(parseTxV2(bytes).feeTokenIndex).toBe(255);
    expect(NATIVE).toHaveLength(32);
  });
});
