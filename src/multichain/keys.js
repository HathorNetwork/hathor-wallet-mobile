/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { multichainKeyMap } from '../constants';
import { logger } from '../logger';
import { STORE } from '../store';
import { ensureNextClient } from './nextClient';

const log = logger('multichain-keys');

/**
 * What the wallet saved about Hathor Next. All of it is public: the address, the public spend key,
 * and the networks the wallet was registered on. Its keys are never saved.
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

// The derivation an unlock started, while it runs: a load that needs the keys waits for it
// instead of failing for want of them (the passkey unlock doesn't wait for it to finish).
let unlockDerivation = null;

/**
 * At an unlock, with the words the PIN or the passkey gave: derives the Hathor Next keys if the
 * wallet used Hathor Next before. It never rejects, so it can't fail an unlock.
 *
 * @param {string} words
 * @returns {Promise<string|null>} The Hathor Next address, or null when none is known yet
 */
export function prepareNextKeysAtUnlock(words) {
  if (!hasUsedNext()) {
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
