/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cryptoUtils } from '@hathor/wallet-lib';
import { multichainKeyMap } from '../constants';
import { logger } from '../logger';
import { STORE } from '../store';
import { ensureNextClient } from './nextClient';
import {
  bigintToBytesLE,
  bytesToBigintLE,
  bytesToHex,
  hexToBytes,
} from './next/kit/scalar';

const log = logger('multichain-keys');

/**
 * The Hathor Next account's BIP32 path: account HATHOR_NEXT_ACCOUNT_INDEX of the kit (3), which a
 * test holds equal. Written out here because this module loads at start, and the kit's keys
 * module would bring the Hathor Next crypto library with it.
 */
export const NEXT_ACCOUNT_PATH = "m/44'/280'/3'";

/**
 * What the wallet saved about Hathor Next. All of it is public: the address, the public spend key,
 * and the networks the wallet was registered on. The spend secret is saved apart, encrypted with
 * the PIN (prepareNextKeysWithPin).
 *
 * @returns {{
 *   address: string|null,
 *   pubB: string|null,
 *   registered: { [network: string]: true },
 * }}
 */
export function loadSavedNext() {
  return {
    address: null,
    pubB: null,
    registered: {},
    ...(STORE.getItem(multichainKeyMap.next) ?? {}),
  };
}

/**
 * @param {Object} patch Part of what loadSavedNext returns
 */
export function saveNext(patch) {
  const saved = STORE.getItem(multichainKeyMap.next) ?? {};
  STORE.setItem(multichainKeyMap.next, { ...saved, ...patch });
}

/**
 * Whether this wallet used Hathor Next before, so its keys are prepared at every unlock and
 * loading Hathor Next needs no PIN or passkey.
 *
 * @returns {boolean}
 */
export function hasUsedNext() {
  const saved = loadSavedNext();
  return Boolean(saved.address || saved.pubB);
}

/**
 * The Hathor Next account node of a wallet's BIP32 root (wallet-lib's HDPrivateKey of these
 * words): `m/44'/280'/3'`, derived as BIP32 says (compliant, as the kit derives it from the seed),
 * as `key ‖ chain code`. A passkey ceremony that already derived the root gives it, so the words
 * are not stretched a second time.
 *
 * @param {Object} root The wallet's root HDPrivateKey (depth 0)
 * @returns {Uint8Array} 64 bytes
 */
export function nextAccountNodeOfRoot(root) {
  if (root?.depth !== 0) {
    throw new Error('The Hathor Next keys derive from the wallet\'s root key.');
  }
  // bitcore serializes the key as 32 bytes, leading zeros included, as BIP32 does: a test pins it
  // with a wallet whose key starts with a zero byte (and a shorter node is refused by the kit).
  const { privateKey, chainCode } = root.deriveChild(NEXT_ACCOUNT_PATH).toObject();
  return hexToBytes(`${privateKey}${chainCode}`);
}

/**
 * Derives the wallet's Hathor Next keys from its words into the running client, and saves what
 * public they give: the address, or the public spend key of a client that knows its address only
 * once connected. The caller drops the words.
 *
 * @param {string} words
 * @param {Object} [root] The wallet's root key, when a passkey ceremony already derived it from
 *   these words: the keys then come from it, with no second stretch of the words
 * @returns {Promise<string|null>} The Hathor Next address, when already known
 */
export async function prepareNextKeys(words, root = null) {
  const accountNode = root ? nextAccountNodeOfRoot(root) : undefined;
  const { address = null, pubB = null } = await ensureNextClient().prepareKeys({
    words,
    ...(accountNode ? { accountNode } : {}),
  });
  saveNext(address ? { address } : { pubB });
  return address;
}

/**
 * The wallet's own public key on Hathor Network, which tells it apart from any other: null when
 * its access data can't be read.
 *
 * @returns {Promise<string|null>}
 */
async function walletXpub() {
  try {
    const { accessData } = await STORE.getAvailableAccessData();
    return accessData?.xpubkey ?? null;
  } catch (e) {
    return null;
  }
}

/**
 * Derives the Hathor Next keys with the PIN. The words are stretched (2,048 rounds of PBKDF2, which
 * hold the JS thread for seconds on a phone) only the first time: the spend secret they give is
 * then kept on this device, encrypted with the PIN as the wallet's words are, and every later
 * unlock decrypts it instead. A PIN change, and a move of the words to the biometry's password,
 * move it too (changePinOnAccessData).
 *
 * It is kept with the wallet's own public key and the public spend key it gives. A copy that is
 * another wallet's, that the PIN doesn't open, or whose secret doesn't give its public key, is
 * derived again from the words, and saved again. It is under the wallet's keys, so a wallet reset
 * clears it.
 *
 * @param {string} pinCode
 * @param {Function} wordsOf The wallet's words, decrypted with the PIN: (pinCode) => Promise
 * @returns {Promise<string|null>} The address, as prepareNextKeys
 */
export async function prepareNextKeysWithPin(pinCode, wordsOf) {
  const client = ensureNextClient();
  const xpub = await walletXpub();
  const saved = STORE.getItem(multichainKeyMap.nextSecret);
  if (saved && client.prepareKeysFromSecret) {
    try {
      if (!xpub || saved.xpub !== xpub) {
        throw new Error('The saved Hathor Next secret is not this wallet\'s.');
      }
      const secret = cryptoUtils.decryptData(saved.secret, pinCode);
      const { pubB } = client.prepareKeysFromSecret({
        spendSecret: bytesToBigintLE(hexToBytes(secret)),
      });
      if (pubB === saved.pubB) {
        saveNext({ pubB });
        return null;
      }
      client.forgetKeys();
      log.error('The saved Hathor Next secret doesn\'t give its public key; deriving it again.');
    } catch (e) {
      log.error('The saved Hathor Next secret can\'t be used; deriving it again.', e);
    }
  }
  const words = await wordsOf(pinCode);
  const { address = null, pubB = null, spendSecret } = await client.prepareKeys({ words });
  if (spendSecret !== undefined) {
    STORE.setItem(multichainKeyMap.nextSecret, {
      xpub,
      pubB,
      secret: cryptoUtils.encryptData(bytesToHex(bigintToBytesLE(spendSecret)), pinCode),
    });
  }
  saveNext(address ? { address } : { pubB });
  return address;
}

// The derivation an unlock started, while it runs: a load that needs the keys waits for it
// instead of failing for want of them (the passkey unlock doesn't wait for it to finish).
let unlockDerivation = null;

/**
 * At an unlock, with the words the PIN or the passkey gave: derives the Hathor Next keys if the
 * multichain flag is on and the wallet used Hathor Next before. It never rejects, so it can't fail
 * an unlock.
 *
 * @param {string} words
 * @param {boolean} multichainOn The multichain flag, as the unlock knows it
 *   (getMultichainFeatureToggleAtUnlock)
 * @param {Object} [root] The wallet's root key, which a passkey ceremony derived from these words
 *   (prepareNextKeys)
 * @returns {Promise<string|null>} The Hathor Next address, or null when none is known yet
 */
export function prepareNextKeysAtUnlock(words, multichainOn, root = null) {
  if (!multichainOn || !hasUsedNext()) {
    return Promise.resolve(null);
  }
  const derivation = (async () => {
    try {
      return await prepareNextKeys(words, root);
    } catch (e) {
      log.error('Could not derive the Hathor Next keys at unlock.', e);
      return null;
    } finally {
      if (unlockDerivation === derivation) {
        unlockDerivation = null;
      }
    }
  })();
  unlockDerivation = derivation;
  return derivation;
}

/** @returns {Promise<string|null>|null} The unlock's derivation while it runs */
export function pendingUnlockDerivation() {
  return unlockDerivation;
}
