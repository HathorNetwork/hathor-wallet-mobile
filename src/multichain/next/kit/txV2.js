/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { blake3 } from '@noble/hashes/blake3';
import { domainHash } from './hash';
import { asciiBytes, bytesToBigintLE } from './scalar';

/**
 * Reads the one shape of Hathor Next transaction this wallet signs, ported from
 * `samba-types/src/tx_v2.rs`: wire format v2, transparent inputs (each one an output index and a
 * Schnorr signature), full shielded outputs, and an excess. The wallet never builds one: the
 * backend does, and the wallet reads it to check it before signing. Any other shape is refused.
 *
 * Layout, integers little-endian:
 *   version u8 ‖ n_in u8 ‖ n_out u8 ‖ r_pub 32 ‖ fee_token u8 ‖ fee_amount (8|16) ‖
 *   table_len u8 ‖ table 32×len ‖ inputs ‖ outputs ‖ range_proof ‖ excess (E ‖ R ‖ s)
 *   input:  output_index u64 ‖ signature 64
 *   output: one_time_key 32 ‖ asset_tag 32 ‖ commitment 32 ‖ limb_lo 32 ‖ [limb_hi 32] ‖
 *           link (160|256) ‖ surjection (36 + 32·n_in) ‖ view_tag u8 ‖ memo (8|16)
 */

/** The version bytes of the shape: transparent inputs, shielded outputs, excess; u64 or u128. */
export const SIGNED_SHIELDED_V2 = { 0x1a: 'u64', 0x1e: 'u128' };

/** A fee token index of 255 is the network's native token, which the table never lists. */
export const TOKEN_INDEX_NATIVE = 255;

export const MAX_INPUTS = 16;
export const MAX_OUTPUTS = 16;
export const MAX_TOKEN_TABLE = 16;
export const SIG_LEN = 64;
const EXCESS_LEN = 96;

/**
 * The aggregated range proof's length for `nOut` committed outputs, in either format.
 *
 * @param {boolean} u128
 * @param {number} nOut
 * @returns {number}
 */
export function rangeProofLen(u128, nOut) {
  const limbs = u128 ? 2 * nOut : nOut;
  let m = 1;
  while (m < limbs) m *= 2;
  const log2m = Math.log2(m);
  return 32 * (2 * (6 + log2m) + 9);
}

/**
 * Parses a transaction of the signed shielded shape.
 *
 * @param {Uint8Array} bytes
 * @returns {Object} Where every field and signature is
 * @throws {Error} For any other shape, or bytes that disagree with their header
 */
export function parseTxV2(bytes) {
  const width = SIGNED_SHIELDED_V2[bytes[0]];
  if (!width) {
    throw new Error('Not a transaction this wallet signs.');
  }
  const u128 = width === 'u128';
  const nIn = bytes[1];
  const nOut = bytes[2];
  if (!nIn || nIn > MAX_INPUTS || !nOut || nOut > MAX_OUTPUTS) {
    throw new Error('The transaction has too few or too many inputs or outputs.');
  }
  const amountLen = u128 ? 16 : 8;
  const rPub = bytes.slice(3, 35);
  const feeTokenIndex = bytes[35];
  const feeAmount = bytesToBigintLE(bytes.slice(36, 36 + amountLen));
  let off = 36 + amountLen;
  const tableLen = bytes[off];
  if (tableLen > MAX_TOKEN_TABLE) {
    throw new Error('The transaction names too many tokens.');
  }
  off += 1;
  const table = [];
  for (let i = 0; i < tableLen; i += 1) {
    table.push(bytes.slice(off + 32 * i, off + 32 * (i + 1)));
  }
  const inputsOff = off + 32 * tableLen;
  const inputLen = 8 + SIG_LEN;
  const linkLen = u128 ? 256 : 160;
  const memoLen = u128 ? 16 : 8;
  const points = u128 ? 5 : 4;
  const surjectionLen = 36 + 32 * nIn;
  const outputLen = 32 * points + linkLen + surjectionLen + 1 + memoLen;
  const outputsOff = inputsOff + nIn * inputLen;
  const rangeOff = outputsOff + nOut * outputLen;
  const excessOff = rangeOff + rangeProofLen(u128, nOut);
  if (bytes.length !== excessOff + EXCESS_LEN) {
    throw new Error('The transaction is not as long as its header says.');
  }

  const inputs = [];
  for (let i = 0; i < nIn; i += 1) {
    const o = inputsOff + i * inputLen;
    inputs.push({
      outputIndex: bytesToBigintLE(bytes.slice(o, o + 8)),
      signatureOffset: o + 8,
    });
  }
  const outputs = [];
  for (let j = 0; j < nOut; j += 1) {
    const o = outputsOff + j * outputLen;
    const tagOff = o + 32 * points + linkLen + surjectionLen;
    outputs.push({
      oneTimeKey: bytes.slice(o, o + 32),
      assetTag: bytes.slice(o + 32, o + 64),
      commitment: bytes.slice(o + 64, o + 96),
      viewTag: bytes[tagOff],
      memo: bytes.slice(tagOff + 1, tagOff + 1 + memoLen),
    });
  }
  return {
    format: 'v2',
    width,
    nIn,
    nOut,
    rPub,
    feeTokenIndex,
    feeAmount,
    table,
    inputs,
    outputs,
    excess: {
      point: bytes.slice(excessOff, excessOff + 32),
      signature: bytes.slice(excessOff + 32, excessOff + EXCESS_LEN),
      signatureOffset: excessOff + 32,
    },
  };
}

/**
 * What every input signs: `blake3("samba/txhash" ‖ 0 ‖ bytes)` with every input signature and
 * the excess signature zeroed. Computed here from the bytes, never taken from the backend.
 *
 * @param {Uint8Array} bytes
 * @param {Object} tx parseTxV2(bytes)
 * @returns {Uint8Array} 32 bytes
 */
export function signingHashOf(bytes, tx) {
  const zeroed = Uint8Array.from(bytes);
  for (const input of tx.inputs) {
    zeroed.fill(0, input.signatureOffset, input.signatureOffset + SIG_LEN);
  }
  zeroed.fill(0, tx.excess.signatureOffset, tx.excess.signatureOffset + SIG_LEN);
  const hasher = blake3.create({});
  hasher.update(asciiBytes('samba/txhash'));
  hasher.update(Uint8Array.of(0));
  hasher.update(zeroed);
  return hasher.digest();
}

/**
 * The bytes with each input's signature put in, in input order.
 *
 * @param {Uint8Array} bytes
 * @param {Object} tx parseTxV2(bytes)
 * @param {Uint8Array[]} signatures 64 bytes each
 * @returns {Uint8Array}
 */
export function withInputSignatures(bytes, tx, signatures) {
  if (signatures.length !== tx.inputs.length) {
    throw new Error('One signature per input.');
  }
  const signed = Uint8Array.from(bytes);
  tx.inputs.forEach((input, i) => {
    if (signatures[i].length !== SIG_LEN) {
      throw new Error('A signature is 64 bytes.');
    }
    signed.set(signatures[i], input.signatureOffset);
  });
  return signed;
}

/**
 * A v2 transaction's id: `blake3("samba/txid" ‖ 0 ‖ bytes)`.
 *
 * @param {Uint8Array} bytes The signed transaction
 * @returns {Uint8Array} 32 bytes
 */
export function txIdOf(bytes) {
  return domainHash('samba/txid', bytes);
}
