/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-bitwise -- BIP32 serializes the hardened index with bit operations */

import { hmac } from '@noble/hashes/hmac';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha512 } from '@noble/hashes/sha512';
import { utf8ToBytes } from '@noble/hashes/utils';
import { RistrettoPoint } from '@noble/curves/ed25519';
import { domainHash, hashToScalar } from './hash';
import {
  asciiBytes,
  bigintToBytesBE,
  bytesToBigintBE,
  concatBytes,
} from './scalar';

/**
 * Hathor Next keys, ported from `samba-wallet-sdk/src/keys.rs` (the `samba-hathor-bip44-v1`
 * scheme): the words give a BIP39 seed, the seed a hardened BIP32 account node
 * `m/44'/280'/account'`, and the node's 64 bytes the two Ristretto secrets by a domain-separated
 * hash.
 *
 * The Hathor Wallet uses account 3: accounts 0, 1 and 2 hold its P2PKH and shielded keys
 * (wallet-lib's HATHOR_NEXT_ACCT_PATH reserves 3). The Hathor Next wallet app uses account 0
 * for the same words, so the two apps never hold keys to the same outputs.
 */

export const HATHOR_NEXT_ACCOUNT_INDEX = 3;

const HARDENED = 0x80000000;
const PURPOSE = 44;
const HATHOR_COIN_TYPE = 280;
// The secp256k1 group order n: BIP32 private keys live in its scalar field.
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

/**
 * The BIP39 seed of a mnemonic: PBKDF2-HMAC-SHA512, 2048 rounds, salt "mnemonic" ‖ passphrase.
 * Asynchronous, so the stretching doesn't hold the UI thread.
 *
 * @param {string} mnemonic
 * @param {string} [passphrase]
 * @returns {Promise<Uint8Array>} 64 bytes
 */
export async function mnemonicToSeed(mnemonic, passphrase = '') {
  const words = mnemonic.trim().split(/\s+/).join(' ');
  return pbkdf2Async(
    sha512,
    utf8ToBytes(words.normalize('NFKD')),
    utf8ToBytes(`mnemonic${passphrase.normalize('NFKD')}`),
    { c: 2048, dkLen: 64 },
  );
}

/**
 * A hardened child of a BIP32 node. Erroring on the ≈2^-127 invalid case keeps the derivation a
 * pure function of its inputs, as the Rust code does.
 *
 * @param {{ key: Uint8Array, chainCode: Uint8Array }} node
 * @param {number} index Below 2^31; the hardened bit is set here
 * @returns {{ key: Uint8Array, chainCode: Uint8Array }}
 */
function childHardened(node, index) {
  if (!Number.isInteger(index) || index < 0 || index >= HARDENED) {
    throw new Error('The account index is out of range.');
  }
  const ser32 = new Uint8Array(4);
  new DataView(ser32.buffer).setUint32(0, (index | HARDENED) >>> 0, false);
  const i = hmac(sha512, node.chainCode, concatBytes(Uint8Array.of(0), node.key, ser32));
  const il = bytesToBigintBE(i.slice(0, 32));
  if (il >= SECP256K1_N) {
    throw new Error('Invalid BIP32 child key.');
  }
  const key = (il + bytesToBigintBE(node.key)) % SECP256K1_N;
  if (key === 0n) {
    throw new Error('Invalid BIP32 child key.');
  }
  return { key: bigintToBytesBE(key), chainCode: i.slice(32) };
}

/**
 * The account node `m/44'/280'/account'` as `key ‖ chain code`, the bytes the scalar mapping
 * consumes.
 *
 * @param {Uint8Array} seed64 The BIP39 seed
 * @param {number} accountIndex
 * @returns {Uint8Array} 64 bytes
 */
export function accountNode64(seed64, accountIndex) {
  const master = hmac(sha512, asciiBytes('Bitcoin seed'), seed64);
  const masterKey = bytesToBigintBE(master.slice(0, 32));
  if (masterKey === 0n || masterKey >= SECP256K1_N) {
    throw new Error('Invalid BIP32 master key.');
  }
  let node = { key: master.slice(0, 32), chainCode: master.slice(32) };
  for (const index of [PURPOSE, HATHOR_COIN_TYPE, accountIndex]) {
    node = childHardened(node, index);
  }
  return concatBytes(node.key, node.chainCode);
}

/**
 * The public key of a scalar: its compressed Ristretto point.
 *
 * @param {bigint} secret
 * @returns {Uint8Array} 32 bytes
 */
export function publicKeyOf(secret) {
  return RistrettoPoint.BASE.multiply(secret).toRawBytes();
}

/**
 * An account's two Hathor Next secrets: `a` (view; derived, unused while the wallet service holds
 * the view key) and `b` (spend).
 *
 * @param {Uint8Array} seed64
 * @param {number} [accountIndex]
 * @returns {{ a: bigint, b: bigint }}
 */
export function deriveAccount(seed64, accountIndex = HATHOR_NEXT_ACCOUNT_INDEX) {
  const node64 = accountNode64(seed64, accountIndex);
  return {
    a: hashToScalar('samba/walletd/view/v1', [node64]),
    b: hashToScalar('samba/walletd/spend/v1', [node64]),
  };
}

/**
 * A wallet's id at a wallet service: `blake3("samba/walletid" ‖ 0x00 ‖ pub_a ‖ pub_b)`, where
 * pub_a is the service's view key.
 *
 * @param {Uint8Array} pubA
 * @param {Uint8Array} pubB
 * @returns {Uint8Array} 32 bytes
 */
export function walletIdOf(pubA, pubB) {
  return domainHash('samba/walletid', concatBytes(pubA, pubB));
}
