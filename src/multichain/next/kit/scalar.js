/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-bitwise -- byte and integer conversion is bit manipulation */

/**
 * Byte and scalar helpers for Hathor Next's Ristretto255 keys. Scalars are bigints in
 * [0, ORDER); on the wire they are 32 bytes, little-endian (curve25519-dalek's encoding).
 */

/** The order of the Ristretto255 group, ℓ = 2^252 + 27742317777372353535851937790883648493. */
export const ORDER = 2n ** 252n + 27742317777372353535851937790883648493n;

/**
 * @param {Uint8Array} bytes
 * @returns {bigint} The little-endian integer
 */
export function bytesToBigintLE(bytes) {
  let value = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  return value;
}

/**
 * @param {bigint} value Below 2^256
 * @returns {Uint8Array} 32 bytes, little-endian
 */
export function bigintToBytesLE(value) {
  const out = new Uint8Array(32);
  let rest = value;
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

/**
 * @param {Uint8Array} bytes
 * @returns {bigint} The big-endian integer
 */
export function bytesToBigintBE(bytes) {
  return bytesToBigintLE(Uint8Array.from(bytes).reverse());
}

/**
 * @param {bigint} value Below 2^256
 * @returns {Uint8Array} 32 bytes, big-endian
 */
export function bigintToBytesBE(value) {
  return bigintToBytesLE(value).reverse();
}

/**
 * @param {bigint} value
 * @returns {bigint} value mod ORDER, never negative
 */
export function modOrder(value) {
  const r = value % ORDER;
  return r < 0n ? r + ORDER : r;
}

/**
 * A canonical scalar from its 32-byte encoding. A non-canonical encoding (≥ ORDER) is refused,
 * as dalek's `Scalar::from_canonical_bytes` refuses it.
 *
 * @param {Uint8Array} bytes
 * @returns {bigint}
 */
export function scalarFromCanonical(bytes) {
  if (bytes.length !== 32) {
    throw new Error('A scalar is 32 bytes.');
  }
  const value = bytesToBigintLE(bytes);
  if (value >= ORDER) {
    throw new Error('Not a canonical scalar.');
  }
  return value;
}

/**
 * @param {string} hex
 * @returns {Uint8Array}
 */
export function hexToBytes(hex) {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('Not hexadecimal.');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  }
  return out;
}

/**
 * @param {Uint8Array} bytes
 * @returns {string} Lowercase hex
 */
export function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {...Uint8Array} parts
 * @returns {Uint8Array}
 */
export function concatBytes(...parts) {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * The bytes of an ASCII string. Every domain and prefix Hathor Next signs is ASCII.
 *
 * @param {string} text
 * @returns {Uint8Array}
 */
export function asciiBytes(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > 0x7f) {
      throw new Error('Not ASCII.');
    }
    out[i] = code;
  }
  return out;
}

/**
 * @param {bigint|number} value Below 2^64
 * @returns {Uint8Array} 8 bytes, little-endian
 */
export function u64LE(value) {
  const out = new Uint8Array(8);
  let rest = BigInt(value);
  for (let i = 0; i < 8; i += 1) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}
