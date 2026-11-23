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
import { NEXT_ACCOUNT_PATH, nextAccountNodeOfRoot, prepareNextKeys } from '../../src/multichain/keys';
import * as nextClient from '../../src/multichain/nextClient';
import * as kitKeys from '../../src/multichain/next/kit/keys';
import { bytesToHex } from '../../src/multichain/next/kit/scalar';
import { createBackendNextClient } from '../../src/multichain/next/backendClient';
/* eslint-enable import/first */

// Real BIP39 stretches, seconds each on a loaded machine: well past jest's default 5 s.
jest.setTimeout(30000);

// A passkey ceremony can derive the wallet's root once and hand it to every key it derives. What
// each derives from that root must be exactly what it derives from the words. These are the real
// derivations (wallet-lib and the Hathor Next kit), offline.

/** The words a passkey gives for its 32-byte PRF secret (passkeyService's wordsFromPrf). */
const wordsOf = (entropyHex) => walletUtils.generateWalletWords(Buffer.from(entropyHex, 'hex'));

// Found by search; each is pinned below to do what its name says. A BIP32 key with a leading zero
// byte is where a derivation that drops it gives other keys. bitcore's non-compliant derivation
// drops the zero bytes of the parent's key, so each step of a path is compliant or not on its own,
// and only a wallet whose key at that step starts with a zero byte tells the two apart: there is
// one for every step of the Hathor Next path.
const ACCOUNT_LEADING_ZERO = wordsOf('68e8fcf65b8e0e9bed28e4edf8256a97e6d6f1b45d7f04ce74354119a74a2e8b');
const ROOT_LEADING_ZERO = wordsOf('d72000b1a3d87570fb87ae61e89f081390a0e41d09cb79b23778cb49058d2ac3');
const PURPOSE_LEADING_ZERO = wordsOf('f486da81e55ec5a53a5598863bfe8a0945d9ee077f99988d13b7c692bf192e51');
const COIN_LEADING_ZERO = wordsOf('8550ba1055fd51df972eb39f3b04c3f6b4ff8d09f408405d53a217eb202ded42');
const ROOT_TWO_ZEROS = wordsOf('f4bbe278533424bba9bc4b713b4285ca46131915a243df7d920bc01a89a5390e');
const ACCOUNT_TWO_ZEROS = wordsOf('8569fbf5713fe927248a83106ef85ee7444f1327ce7606a136460316598557d9');
const ACCOUNT_CHAIN_CODE_ZERO = wordsOf('d8cc3ccd5ba06bb373385265abaaca5785f3b4ab3b0e34cdfe6a0377500d7f2a');
const VECTORS = [
  ['the BIP39 test words', `${'abandon '.repeat(23)}art`],
  ['a wallet whose Hathor Next account key starts with a zero byte', ACCOUNT_LEADING_ZERO],
  ['a wallet whose root key starts with a zero byte', ROOT_LEADING_ZERO],
  ["a wallet whose m/44' key starts with a zero byte", PURPOSE_LEADING_ZERO],
  ["a wallet whose m/44'/280' key starts with a zero byte", COIN_LEADING_ZERO],
  ['a wallet whose root key starts with two zero bytes', ROOT_TWO_ZEROS],
  ['a wallet whose Hathor Next account key starts with two zero bytes', ACCOUNT_TWO_ZEROS],
  ['a wallet whose Hathor Next account chain code starts with a zero byte', ACCOUNT_CHAIN_CODE_ZERO],
];

// BigInts as hex: jest's workers can't send a BigInt in a failure's report.
const hexOf = (record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [
  key, typeof value === 'bigint' ? value.toString(16) : value,
]));

// Each wallet's root, stretched once for the whole file as a ceremony stretches it once. Nothing
// here changes a root.
const roots = new Map();
const rootOf = (words) => {
  if (!roots.has(words)) {
    roots.set(words, walletUtils.getXPrivKeyFromSeed(words, { networkName: NETWORK_MAINNET }));
  }
  return roots.get(words);
};
const keyBytesOf = (node) => Buffer.from(node.toObject().privateKey, 'hex');
const chainCodeOf = (node) => Buffer.from(node.toObject().chainCode, 'hex');

// No connect runs here; a request would be refused.
const newClient = () => createBackendNextClient({
  fetchImpl: () => { throw new Error('no network in this test'); },
  WebSocketImpl: null,
});

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
    expect(keyBytesOf(rootOf(PURPOSE_LEADING_ZERO).deriveChild("m/44'"))[0]).toBe(0);
    expect(keyBytesOf(rootOf(COIN_LEADING_ZERO).deriveChild("m/44'/280'"))[0]).toBe(0);
    expect([...keyBytesOf(rootOf(ROOT_TWO_ZEROS)).subarray(0, 2)]).toEqual([0, 0]);
    const account = rootOf(ACCOUNT_TWO_ZEROS).deriveChild(NEXT_ACCOUNT_PATH);
    expect([...keyBytesOf(account).subarray(0, 2)]).toEqual([0, 0]);
    expect(chainCodeOf(rootOf(ACCOUNT_CHAIN_CODE_ZERO).deriveChild(NEXT_ACCOUNT_PATH))[0]).toBe(0);
  });

  // Under these roots, a derivation that is compliant at some steps only gives another Hathor
  // Next account: compliance is pinned at every step of the path.
  test.each([
    ['non-compliant from the root', ROOT_LEADING_ZERO, (root) => root.deriveNonCompliantChild(NEXT_ACCOUNT_PATH)],
    ["non-compliant below m/44'", PURPOSE_LEADING_ZERO, (root) => root.deriveChild("m/44'").deriveNonCompliantChild("m/280'/3'")],
    ["non-compliant below m/44'/280'", COIN_LEADING_ZERO, (root) => root.deriveChild("m/44'/280'").deriveNonCompliantChild("m/3'")],
  ])('a Hathor Next path derived %s gives another account under its vector', (name, words, derive) => {
    const root = rootOf(words);
    expect(derive(root).xprivkey).not.toBe(root.deriveChild(NEXT_ACCOUNT_PATH).xprivkey);
  });

  // The passkey check is the other way round: wallet-lib derives the account non-compliantly at
  // every step, and so must the check from the root, or it refuses the wallet's own passkey.
  test.each([
    ["m/44'", PURPOSE_LEADING_ZERO, (root) => root.deriveNonCompliantChild("m/44'").deriveChild("m/280'/0'")],
    ["m/44'/280'", COIN_LEADING_ZERO, (root) => root.deriveNonCompliantChild("m/44'/280'").deriveChild("m/0'")],
  ])('a passkey check that is compliant below %s gives another xpub under its vector', (name, words, derive) => {
    expect(derive(rootOf(words)).xpubkey).not.toBe(derivePasskeyXpub(words));
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

  // A node derived for a client that never loaded would be dropped with its bytes in memory.
  test('derives no node for a client that can\'t load', async () => {
    const root = {
      depth: 0,
      deriveChild: jest.fn(() => ({
        toObject: () => ({ privateKey: '11'.repeat(32), chainCode: '22'.repeat(32) }),
      })),
    };
    jest.spyOn(nextClient, 'ensureNextClient').mockImplementation(() => {
      throw new Error('the client cannot load');
    });

    await expect(prepareNextKeys('passkey words', root)).rejects.toThrow('the client cannot load');
    expect(root.deriveChild).not.toHaveBeenCalled();
  });
});

describe('the Hathor Next client given the account node', () => {
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

  test('wipes a node it refuses too, and keeps no keys', async () => {
    const client = newClient();
    const accountNode = new Uint8Array(63).fill(7);

    await expect(client.prepareKeys({ words: VECTORS[0][1], accountNode }))
      .rejects.toThrow('64 bytes');

    expect(accountNode.every((byte) => byte === 0)).toBe(true);
    expect(client.hasKeys()).toBe(false);
  });

  // The keys live from an unlock to the next lock, however they were derived: a lock that lands
  // as the node is handed takes them, as a lock during a stretch of the words leaves none.
  test('keeps no keys when the app locks right after the node was handed', async () => {
    const client = newClient();
    const accountNode = nextAccountNodeOfRoot(rootOf(VECTORS[0][1]));

    const deriving = client.prepareKeys({ words: VECTORS[0][1], accountNode });
    client.forgetKeys();
    await deriving.catch(() => {});

    expect(client.hasKeys()).toBe(false);
    expect(accountNode.every((byte) => byte === 0)).toBe(true);
  });
});
