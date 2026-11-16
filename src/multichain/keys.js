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
 * Derives the wallet's Hathor Next keys from its words into the running client, and saves what
 * public they give: the address, or the public spend key of a client that knows its address only
 * once connected. The caller drops the words.
 *
 * @param {string} words
 * @returns {Promise<string|null>} The Hathor Next address, when already known
 */
export async function prepareNextKeys(words) {
  const { address = null, pubB = null } = await ensureNextClient().prepareKeys({ words });
  saveNext(address ? { address } : { pubB });
  return address;
}

/**
 * Derives the Hathor Next keys with the PIN. The words are stretched (2,048 rounds of PBKDF2, which
 * hold the JS thread for seconds on a phone) only the first time: the spend secret they give is
 * then kept on this device, encrypted with the PIN as the wallet's words are, and every later
 * unlock decrypts it instead. A copy the PIN doesn't open (the PIN changed) or that is another
 * wallet's is derived again from the words, and saved again. It is under the wallet's keys, so a
 * wallet reset clears it.
 *
 * @param {string} pinCode
 * @param {Function} wordsOf The wallet's words, decrypted with the PIN: (pinCode) => Promise
 * @returns {Promise<string|null>} The address, as prepareNextKeys
 */
export async function prepareNextKeysWithPin(pinCode, wordsOf) {
  const client = ensureNextClient();
  const saved = STORE.getItem(multichainKeyMap.nextSecret);
  if (saved && client.prepareKeysFromSecret) {
    try {
      const secret = cryptoUtils.decryptData(saved.secret, pinCode);
      const { pubB } = client.prepareKeysFromSecret({
        spendSecret: bytesToBigintLE(hexToBytes(secret)),
      });
      if (pubB === saved.pubB) {
        saveNext({ pubB });
        return null;
      }
      log.error('The saved Hathor Next secret is not this wallet\'s; deriving it again.');
    } catch (e) {
      log.error('The saved Hathor Next secret could not be read with this PIN; deriving it again.', e);
    }
  }
  const words = await wordsOf(pinCode);
  const { address = null, pubB = null, spendSecret } = await client.prepareKeys({ words });
  if (spendSecret !== undefined) {
    STORE.setItem(multichainKeyMap.nextSecret, {
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
 * @returns {Promise<string|null>} The Hathor Next address, or null when none is known yet
 */
export function prepareNextKeysAtUnlock(words, multichainOn) {
  if (!multichainOn || !hasUsedNext()) {
    return Promise.resolve(null);
  }
  const derivation = (async () => {
    try {
      return await prepareNextKeys(words);
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
