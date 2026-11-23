/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

/* eslint-disable import/first */
import { walletUtils } from '@hathor/wallet-lib';
import { NETWORK_MAINNET } from '../../src/constants';
import { derivePasskeyXpub, passkeyXpubOfRoot } from '../../src/passkey/passkeySigner';
import { derivePasskeyShieldedKeys } from '../../src/passkey/shieldedKeys';
import { NEXT_ACCOUNT_PATH, nextAccountNodeOfRoot } from '../../src/multichain/keys';
import * as kitKeys from '../../src/multichain/next/kit/keys';
import { bytesToHex } from '../../src/multichain/next/kit/scalar';
import { createBackendNextClient } from '../../src/multichain/next/backendClient';
/* eslint-enable import/first */

// A passkey ceremony can derive the wallet's root once and hand it to every key it derives. What
// each derives from that root must be exactly what it derives from the words. These are the real
// derivations (wallet-lib and the Hathor Next kit), offline.

/** The words a passkey gives for its 32-byte PRF secret (passkeyService's wordsFromPrf). */
const wordsOf = (entropyHex) => walletUtils.generateWalletWords(Buffer.from(entropyHex, 'hex'));

// Found by search; each is pinned below to do what its name says. A BIP32 key with a leading zero
// byte is where a derivation that drops it (or derives non-compliantly) gives other keys.
const VECTORS = [
  ['the BIP39 test words', `${'abandon '.repeat(23)}art`],
  ['a wallet whose Hathor Next account key starts with a zero byte',
    wordsOf('68e8fcf65b8e0e9bed28e4edf8256a97e6d6f1b45d7f04ce74354119a74a2e8b')],
  ['a wallet whose root key starts with a zero byte',
    wordsOf('d72000b1a3d87570fb87ae61e89f081390a0e41d09cb79b23778cb49058d2ac3')],
];
const ACCOUNT_LEADING_ZERO = VECTORS[1][1];
const ROOT_LEADING_ZERO = VECTORS[2][1];

// BigInts as hex: jest's workers can't send a BigInt in a failure's report.
const hexOf = (record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [
  key, typeof value === 'bigint' ? value.toString(16) : value,
]));

const rootOf = (words) => walletUtils.getXPrivKeyFromSeed(words, { networkName: NETWORK_MAINNET });
const keyBytesOf = (node) => Buffer.from(node.toObject().privateKey, 'hex');

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the keys a passkey ceremony derives from its root', () => {
  test('the vectors are what they say', async () => {
    const accountNode = kitKeys.accountNode64(
      await kitKeys.mnemonicToSeed(ACCOUNT_LEADING_ZERO),
      kitKeys.HATHOR_NEXT_ACCOUNT_INDEX,
    );
    expect(accountNode[0]).toBe(0);
    // The node of the root carries that zero: the key is serialized as 32 bytes.
    const nodeOfRoot = nextAccountNodeOfRoot(rootOf(ACCOUNT_LEADING_ZERO));
    expect(nodeOfRoot.length).toBe(64);
    expect(nodeOfRoot[0]).toBe(0);
    expect(keyBytesOf(rootOf(ROOT_LEADING_ZERO))).toHaveLength(32);
    expect(keyBytesOf(rootOf(ROOT_LEADING_ZERO))[0]).toBe(0);
    // Under that root, a non-compliant derivation gives another account: compliance is pinned.
    const root = rootOf(ROOT_LEADING_ZERO);
    expect(root.deriveNonCompliantChild(NEXT_ACCOUNT_PATH).xprivkey)
      .not.toBe(root.deriveChild(NEXT_ACCOUNT_PATH).xprivkey);
  });

  test('the Hathor Next path is the kit\'s account', () => {
    expect(NEXT_ACCOUNT_PATH).toBe(`m/44'/280'/${kitKeys.HATHOR_NEXT_ACCOUNT_INDEX}'`);
  });

  test.each(VECTORS)('%s: the passkey check from the root is derivePasskeyXpub', (name, words) => {
    expect(passkeyXpubOfRoot(rootOf(words))).toBe(derivePasskeyXpub(words));
  });

  test.each(VECTORS)('%s: the Hathor Next keys from the root are the kit\'s, from the seed', async (name, words) => {
    const seed = await kitKeys.mnemonicToSeed(words);
    const node = nextAccountNodeOfRoot(rootOf(words));

    expect(bytesToHex(node))
      .toBe(bytesToHex(kitKeys.accountNode64(seed, kitKeys.HATHOR_NEXT_ACCOUNT_INDEX)));
    expect(hexOf(kitKeys.deriveAccountFromNode(node))).toEqual(hexOf(kitKeys.deriveAccount(seed)));
  });

  test.each(VECTORS)('%s: the shielded keys from the root are the ones from the words', (name, words) => {
    expect(derivePasskeyShieldedKeys(words, rootOf(words)))
      .toEqual(derivePasskeyShieldedKeys(words));
  });

  test('only the wallet\'s root gives the Hathor Next node', () => {
    const root = rootOf(VECTORS[0][1]);

    expect(() => nextAccountNodeOfRoot(root.deriveChild("m/44'"))).toThrow('root key');
    expect(() => nextAccountNodeOfRoot(null)).toThrow('root key');
  });

  test('an account node is 64 bytes', () => {
    expect(() => kitKeys.deriveAccountFromNode(new Uint8Array(63))).toThrow('64 bytes');
    expect(() => kitKeys.deriveAccountFromNode(new Uint8Array(65))).toThrow('64 bytes');
    expect(() => kitKeys.deriveAccountFromNode(Array(64).fill(1))).toThrow('64 bytes');
  });
});

describe('the Hathor Next client given the account node', () => {
  // No connect runs here; a request would be refused.
  const newClient = () => createBackendNextClient({
    fetchImpl: () => { throw new Error('no network in this test'); },
    WebSocketImpl: null,
  });

  test.each(VECTORS)('%s: takes the node instead of stretching the words, and wipes it', async (name, words) => {
    const fromWords = await newClient().prepareKeys({ words });
    const stretch = jest.spyOn(kitKeys, 'mnemonicToSeed');
    const accountNode = nextAccountNodeOfRoot(rootOf(words));
    const client = newClient();

    const fromNode = await client.prepareKeys({ words, accountNode });

    expect(hexOf(fromNode)).toEqual(hexOf(fromWords));
    expect(client.hasKeys()).toBe(true);
    expect(stretch).not.toHaveBeenCalled();
    expect(accountNode.every((byte) => byte === 0)).toBe(true);
  });

  test('without it, stretches the words as before', async () => {
    const stretch = jest.spyOn(kitKeys, 'mnemonicToSeed');

    await newClient().prepareKeys({ words: VECTORS[0][1] });

    expect(stretch).toHaveBeenCalledTimes(1);
  });
});
