/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RistrettoPoint } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';
import { hashToScalar } from './hash';
import {
  ORDER,
  asciiBytes,
  bigintToBytesLE,
  bytesToBigintLE,
  concatBytes,
  modOrder,
  u64LE,
} from './scalar';

/**
 * Wallet-service authentication and the Schnorr signature behind it, ported from
 * `samba-crypto/src/wallet_auth.rs` and `samba-crypto/src/schnorr.rs`, and checked against their
 * vectors. Two keys hang below the spend key: the auth key (full sessions) and the read key
 * (read sessions). Both are one-way: neither can spend.
 */

export const SCOPE = { READ: 'read', FULL: 'full' };
const SCOPE_BYTE = { [SCOPE.READ]: 1, [SCOPE.FULL]: 2 };

const LOGIN_PREFIX = asciiBytes('samba/wallet-auth-login/v1\0');
const KEYS_PREFIX = asciiBytes('samba/wallet-auth-keys/v1\0');
const NO_READ_KEY = new Uint8Array(32);

/**
 * @param {bigint} b The spend secret
 * @returns {bigint}
 */
export function authSecret(b) {
  return hashToScalar('samba/wallet-auth-key/v1', [bigintToBytesLE(b)]);
}

/**
 * Derived from the auth key, not from the spend key.
 *
 * @param {bigint} auth
 * @returns {bigint}
 */
export function readSecret(auth) {
  return hashToScalar('samba/wallet-auth-key/read/v1', [bigintToBytesLE(auth)]);
}

/**
 * `LOGIN_PREFIX ‖ wallet_id ‖ scope ‖ ts LE`.
 *
 * @param {Uint8Array} walletId 32 bytes
 * @param {string} scope One of SCOPE
 * @param {number} ts Unix seconds
 * @returns {Uint8Array}
 */
export function loginMessage(walletId, scope, ts) {
  if (!(scope in SCOPE_BYTE)) {
    throw new Error('Unknown session scope.');
  }
  return concatBytes(LOGIN_PREFIX, walletId, Uint8Array.of(SCOPE_BYTE[scope]), u64LE(ts));
}

/**
 * `KEYS_PREFIX ‖ pub_b ‖ auth_pub ‖ read_pub or zeros ‖ ts LE`, signed by the spend key and by
 * the auth key it registers.
 *
 * @param {Uint8Array} pubB
 * @param {Uint8Array} authPub
 * @param {Uint8Array|null} readPub
 * @param {number} ts Unix seconds
 * @returns {Uint8Array}
 */
export function keysMessage(pubB, authPub, readPub, ts) {
  return concatBytes(KEYS_PREFIX, pubB, authPub, readPub ?? NO_READ_KEY, u64LE(ts));
}

/**
 * The Schnorr challenge: `H_scalar("samba/schnorr/challenge" ‖ 0x00 ‖ X ‖ R ‖ msg)`.
 *
 * @param {Uint8Array} publicKey
 * @param {Uint8Array} r
 * @param {Uint8Array} msg
 * @returns {bigint}
 */
function challenge(publicKey, r, msg) {
  return hashToScalar('samba/schnorr/challenge', [publicKey, r, msg]);
}

/**
 * Signs `msg` with `x`: `R = k·G`, `s = k + e·x`, returning `R ‖ s` (64 bytes). The nonce mixes
 * the secret, the message and fresh randomness, so a weak random source alone can't repeat it.
 *
 * @param {bigint} x
 * @param {Uint8Array} msg
 * @param {Uint8Array} [entropy] 32 random bytes; tests pass their own
 * @returns {Uint8Array}
 */
export function schnorrSign(x, msg, entropy = randomBytes(32)) {
  if (x <= 0n) {
    throw new Error('The signing key is unavailable.');
  }
  const k = hashToScalar('hathor-wallet/schnorr-nonce/v1', [bigintToBytesLE(x), msg, entropy]);
  if (k === 0n) {
    throw new Error('Could not sign.');
  }
  const r = RistrettoPoint.BASE.multiply(k).toRawBytes();
  const publicKey = RistrettoPoint.BASE.multiply(x).toRawBytes();
  const e = challenge(publicKey, r, msg);
  return concatBytes(r, bigintToBytesLE(modOrder(k + e * x)));
}

/**
 * Whether `sig` is a valid signature of `msg` by `publicKey`: `s·G == R + e·X`.
 *
 * @param {Uint8Array} publicKey
 * @param {Uint8Array} msg
 * @param {Uint8Array} sig
 * @returns {boolean}
 */
export function schnorrVerify(publicKey, msg, sig) {
  if (sig.length !== 64) {
    return false;
  }
  try {
    const x = RistrettoPoint.fromHex(publicKey);
    const rBytes = sig.slice(0, 32);
    const r = RistrettoPoint.fromHex(rBytes);
    const s = bytesToBigintLE(sig.slice(32));
    if (s >= ORDER) {
      return false;
    }
    const e = challenge(publicKey, rBytes, msg);
    const left = s === 0n ? RistrettoPoint.ZERO : RistrettoPoint.BASE.multiply(s);
    const right = e === 0n ? r : r.add(x.multiply(e));
    return left.equals(right);
  } catch (e) {
    return false;
  }
}
