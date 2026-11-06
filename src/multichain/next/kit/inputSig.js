/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RistrettoPoint } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';
import { hashToScalar } from './hash';
import { ORDER, bigintToBytesLE, bytesToBigintLE, concatBytes, modOrder } from './scalar';

/**
 * The signatures of a transaction's transparent inputs and of its excess, ported from
 * `samba-crypto/src/transparent_sig.rs`: a Schnorr signature `R ‖ s` by the key `P = p·G` over
 * the signing hash, `R = k·G`, `e = H(domain ‖ 0 ‖ P ‖ R ‖ msg)`, `s = k + e·p`. The domains keep
 * an input's signature and the excess's from standing in for one another.
 */

export const INPUT_DOMAIN = 'samba/transparent-input/challenge';
export const EXCESS_DOMAIN = 'samba/excess/challenge';

/**
 * Signs `msg` with the one-time secret `p` of the output whose key is `key`. The nonce mixes the
 * secret, the message and fresh randomness.
 *
 * @param {bigint} p
 * @param {Uint8Array} key `P = p·G`, compressed
 * @param {Uint8Array} msg The 32-byte signing hash
 * @param {Uint8Array} [entropy] 32 random bytes; tests pass their own
 * @returns {Uint8Array} 64 bytes
 */
export function signInput(p, key, msg, entropy = randomBytes(32)) {
  const k = hashToScalar('hathor-wallet/input-nonce/v1', [bigintToBytesLE(p), key, msg, entropy]);
  if (k === 0n || p <= 0n) {
    throw new Error('Could not sign.');
  }
  const r = RistrettoPoint.BASE.multiply(k).toRawBytes();
  const e = hashToScalar(INPUT_DOMAIN, [key, r, msg]);
  return concatBytes(r, bigintToBytesLE(modOrder(k + e * p)));
}

/**
 * Whether `sig` is `key`'s signature of `msg` under `domain`: `s·G == R + e·P`.
 *
 * @param {string} domain INPUT_DOMAIN or EXCESS_DOMAIN
 * @param {Uint8Array} key
 * @param {Uint8Array} msg
 * @param {Uint8Array} sig
 * @returns {boolean}
 */
export function verifyIn(domain, key, msg, sig) {
  if (sig.length !== 64) {
    return false;
  }
  try {
    const point = RistrettoPoint.fromHex(key);
    const rBytes = sig.slice(0, 32);
    const r = RistrettoPoint.fromHex(rBytes);
    const s = bytesToBigintLE(sig.slice(32));
    if (s >= ORDER) {
      return false;
    }
    const e = hashToScalar(domain, [key, rBytes, msg]);
    const left = s === 0n ? RistrettoPoint.ZERO : RistrettoPoint.BASE.multiply(s);
    const right = e === 0n ? r : r.add(point.multiply(e));
    return left.equals(right);
  } catch (e) {
    return false;
  }
}
