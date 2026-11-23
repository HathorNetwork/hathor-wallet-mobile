/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from '@jest/globals';
import derivation from './fixtures/derivation.json';
import walletAuthVectors from './fixtures/wallet-auth.json';
import addressVectors from './fixtures/address-v2.json';
import {
  accountNode64,
  deriveAccount,
  mnemonicToSeed,
  publicKeyOf,
  walletIdOf,
} from '../../../src/multichain/next/kit/keys';
import {
  authSecret,
  keysMessage,
  loginMessage,
  readSecret,
  schnorrSign,
  schnorrVerify,
} from '../../../src/multichain/next/kit/walletAuth';
import {
  AddressError,
  decodeAddress,
  decodeAddressKeys,
  encodeAddress,
} from '../../../src/multichain/next/kit/address';
import {
  bigintToBytesLE,
  bytesToBigintLE,
  bytesToHex,
  concatBytes,
  hexToBytes,
  ORDER,
} from '../../../src/multichain/next/kit/scalar';

// The vectors are Hathor Next's own (samba-wallet-sdk/tests/vectors/derivation.json,
// samba-crypto/tests/wallet_auth_vectors.json, clients/wallet-sdk/fixtures/address/v2.json),
// copied verbatim: matching them is what makes these keys and signatures Hathor Next's.

const scalar = (hex) => bytesToBigintLE(hexToBytes(hex));
const hex = (value) => bytesToHex(bigintToBytesLE(value));

describe('Hathor Next key derivation', () => {
  it.each(derivation.vectors)(
    'derives account $account_index with passphrase "$passphrase"',
    async ({ passphrase, account_index: index, a, b, pub_a: pubA, pub_b: pubB }) => {
      const seed = await mnemonicToSeed(derivation.mnemonic, passphrase);
      const keys = deriveAccount(seed, index);
      expect(hex(keys.a)).toBe(a);
      expect(hex(keys.b)).toBe(b);
      expect(bytesToHex(publicKeyOf(keys.a))).toBe(pubA);
      expect(bytesToHex(publicKeyOf(keys.b))).toBe(pubB);
    },
  );

  it('uses account 3 by default, which no vector account shares', async () => {
    const seed = await mnemonicToSeed(derivation.mnemonic);
    const node = accountNode64(seed, 3);
    expect(node).toHaveLength(64);
    const { b } = deriveAccount(seed);
    const used = derivation.vectors.map((v) => v.b);
    expect(used).not.toContain(hex(b));
    expect(deriveAccount(seed, 3).b).toBe(b);
  });

  it('refuses an account index that is not a whole number in the hardened range', async () => {
    const seed = await mnemonicToSeed(derivation.mnemonic);
    for (const index of [2 ** 31, -1, 1.5]) {
      expect(() => accountNode64(seed, index)).toThrow('The account index is out of range.');
    }
  });

  it('computes the wallet id from the service view key and the spend key', () => {
    const pubA = new Uint8Array(32).fill(1);
    const pubB = new Uint8Array(32).fill(2);
    const id = walletIdOf(pubA, pubB);
    expect(id).toHaveLength(32);
    expect(bytesToHex(walletIdOf(pubB, pubA))).not.toBe(bytesToHex(id));
  });
});

describe('Hathor Next wallet authentication', () => {
  it.each(walletAuthVectors.derivations)('derives the auth and read keys of b=$b', (vector) => {
    const auth = authSecret(scalar(vector.b));
    const read = readSecret(auth);
    expect(hex(auth)).toBe(vector.auth_secret);
    expect(bytesToHex(publicKeyOf(auth))).toBe(vector.auth_pub);
    expect(hex(read)).toBe(vector.read_secret);
    expect(bytesToHex(publicKeyOf(read))).toBe(vector.read_pub);
  });

  it.each(walletAuthVectors.login_messages)(
    'builds and verifies the $scope login of $signed_by',
    (vector) => {
      const message = loginMessage(hexToBytes(vector.wallet_id), vector.scope, vector.ts);
      expect(bytesToHex(message)).toBe(vector.message);
      const signer = walletAuthVectors.derivations.find((d) => (
        [d.auth_pub, d.read_pub].some((pub) => schnorrVerify(
          hexToBytes(pub),
          message,
          hexToBytes(vector.signature),
        ))
      ));
      expect(signer).toBeDefined();
    },
  );

  it.each(walletAuthVectors.keys_messages)('builds and verifies a key registration', (vector) => {
    const message = keysMessage(
      hexToBytes(vector.pub_b),
      hexToBytes(vector.auth_pub),
      vector.read_pub ? hexToBytes(vector.read_pub) : null,
      vector.ts,
    );
    expect(bytesToHex(message)).toBe(vector.message);
    expect(schnorrVerify(hexToBytes(vector.pub_b), message, hexToBytes(vector.sig_b))).toBe(true);
    expect(schnorrVerify(hexToBytes(vector.auth_pub), message, hexToBytes(vector.sig_auth)))
      .toBe(true);
  });

  it('signs so that the signature verifies, and only for its message and key', () => {
    const { b } = walletAuthVectors.derivations[2];
    const auth = authSecret(scalar(b));
    const message = loginMessage(new Uint8Array(32).fill(9), 'full', 1788000000);
    const sig = schnorrSign(auth, message);
    expect(schnorrVerify(publicKeyOf(auth), message, sig)).toBe(true);

    const other = loginMessage(new Uint8Array(32).fill(9), 'read', 1788000000);
    expect(schnorrVerify(publicKeyOf(auth), other, sig)).toBe(false);
    expect(schnorrVerify(publicKeyOf(readSecret(auth)), message, sig)).toBe(false);
    const tampered = Uint8Array.from(sig);
    tampered[40] = tampered[40] === 0 ? 1 : 0;
    expect(schnorrVerify(publicKeyOf(auth), message, tampered)).toBe(false);
  });

  it('never repeats a nonce for different randomness', () => {
    const auth = authSecret(5n);
    const message = loginMessage(new Uint8Array(32), 'full', 1);
    const one = schnorrSign(auth, message, new Uint8Array(32).fill(1));
    const two = schnorrSign(auth, message, new Uint8Array(32).fill(2));
    expect(bytesToHex(one.slice(0, 32))).not.toBe(bytesToHex(two.slice(0, 32)));
  });

  // A nonce that left the secret or the message out would repeat, or be anyone's to compute, with
  // a weak random source: two signatures sharing a nonce give the key away.
  it('takes its nonce from the secret and the message too', () => {
    const auth = authSecret(5n);
    const message = loginMessage(new Uint8Array(32), 'full', 1);
    const entropy = new Uint8Array(32).fill(1);
    const nonceOf = (...args) => bytesToHex(schnorrSign(...args).slice(0, 32));
    const base = nonceOf(auth, message, entropy);
    expect(nonceOf(auth, loginMessage(new Uint8Array(32), 'full', 2), entropy)).not.toBe(base);
    expect(nonceOf(auth + 1n, message, entropy)).not.toBe(base);
    expect(nonceOf(auth, message, entropy)).toBe(base);
  });

  it('never signs with a zero key, nor a login for an unknown scope', () => {
    const message = loginMessage(new Uint8Array(32), 'full', 1);
    expect(() => schnorrSign(0n, message)).toThrow('The signing key is unavailable.');
    expect(() => loginMessage(new Uint8Array(32), 'admin', 1)).toThrow('Unknown session scope.');
  });

  it('verifies a signature only at 64 bytes, with s below the group order', () => {
    const auth = authSecret(5n);
    const key = publicKeyOf(auth);
    const message = loginMessage(new Uint8Array(32), 'full', 1);
    const sig = schnorrSign(auth, message);
    expect(schnorrVerify(key, message, sig)).toBe(true);
    expect(schnorrVerify(key, message, concatBytes(sig, Uint8Array.of(0)))).toBe(false);
    // s + ℓ names the same scalar.
    const s = bytesToBigintLE(sig.slice(32));
    expect(schnorrVerify(key, message, concatBytes(sig.slice(0, 32), bigintToBytesLE(s + ORDER))))
      .toBe(false);
  });
});

describe('Hathor Next addresses', () => {
  it.each(addressVectors.valid)('reads the $name address', (vector) => {
    const decoded = decodeAddress(vector.address);
    expect(decoded).toEqual({ form: vector.form, view: vector.view, spend: vector.spend });
    if (vector.form === 'v2') {
      expect(encodeAddress(vector.view, vector.spend)).toBe(vector.address.toLowerCase());
    }
  });

  it.each(addressVectors.invalid)('refuses an address with $name', (vector) => {
    let error;
    try {
      decodeAddress(vector.address);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(AddressError);
    expect(error.code).toBe(vector.error);
  });

  it.each(addressVectors.not_points)('refuses a key that is not a curve point: $name', (vector) => {
    expect(decodeAddress(vector.address).view).toBe(vector.view);
    let error;
    try {
      decodeAddressKeys(vector.address);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(AddressError);
    expect(error.code).toBe('not-a-point');
  });

  it('is written only from two keys of 64 hex digits', () => {
    const { view, spend } = addressVectors.valid.find((v) => v.form === 'v2');
    expect(() => encodeAddress('zz'.repeat(32), spend)).toThrow('view key must be 64 hex characters');
    expect(() => encodeAddress(view, spend.slice(2))).toThrow('spend key must be 64 hex characters');
  });

  it('builds the address of a derived spend key under a service view key', async () => {
    const seed = await mnemonicToSeed(derivation.mnemonic);
    const pubB = bytesToHex(publicKeyOf(deriveAccount(seed).b));
    const pubA = derivation.vectors[0].pub_a;
    const address = encodeAddress(pubA, pubB);
    expect(decodeAddressKeys(address)).toEqual({
      form: 'v2',
      view: hexToBytes(pubA),
      spend: hexToBytes(pubB),
    });
  });
});

describe('Hathor Next hex, read strictly', () => {
  it('refuses anything but hex digits, and an odd number of them', () => {
    for (const text of ['zz', '0x00', 'ab cd', '-1', 'abc']) {
      expect(() => hexToBytes(text)).toThrow('Not hexadecimal.');
    }
    expect(bytesToHex(hexToBytes('00aB'))).toBe('00ab');
  });
});
