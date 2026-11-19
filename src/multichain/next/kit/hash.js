/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { blake3 } from '@noble/hashes/blake3';
import { RistrettoPoint } from '@noble/curves/ed25519';
import { asciiBytes, bytesToBigintLE, modOrder } from './scalar';

/**
 * Hathor Next's domain-separated hashes, ported from `samba-crypto/src/hash.rs` and
 * `samba-types/src/hash.rs`. Every one hashes `domain ‖ 0x00 ‖ parts` with blake3.
 */

const SEPARATOR = Uint8Array.of(0);

/**
 * The 64-byte blake3 XOF of `domain ‖ 0x00 ‖ parts…`.
 *
 * @param {string} domain
 * @param {Uint8Array[]} parts
 * @returns {Uint8Array}
 */
export function xof64(domain, parts) {
  const hasher = blake3.create({ dkLen: 64 });
  hasher.update(asciiBytes(domain));
  hasher.update(SEPARATOR);
  for (const part of parts) {
    hasher.update(part);
  }
  return hasher.digest();
}

/**
 * A scalar from `domain ‖ 0x00 ‖ parts…`: the 64-byte XOF, reduced mod ℓ (dalek's
 * `Scalar::from_bytes_mod_order_wide`).
 *
 * @param {string} domain
 * @param {Uint8Array[]} parts
 * @returns {bigint}
 */
export function hashToScalar(domain, parts) {
  return modOrder(bytesToBigintLE(xof64(domain, parts)));
}

/**
 * A Ristretto point from `domain ‖ 0x00 ‖ payload`, through the one-way map from 64 uniform bytes
 * (dalek's `RistrettoPoint::from_uniform_bytes`).
 *
 * @param {string} domain
 * @param {Uint8Array} payload
 * @returns {RistrettoPoint}
 */
export function hashToPoint(domain, payload) {
  return RistrettoPoint.hashToCurve(xof64(domain, [payload]));
}

/**
 * The 32-byte `blake3(domain ‖ 0x00 ‖ payload)` (`samba_types::domain_hash`).
 *
 * @param {string} domain
 * @param {Uint8Array} payload
 * @returns {Uint8Array}
 */
export function domainHash(domain, payload) {
  const hasher = blake3.create({});
  hasher.update(asciiBytes(domain));
  hasher.update(SEPARATOR);
  hasher.update(payload);
  return hasher.digest();
}
