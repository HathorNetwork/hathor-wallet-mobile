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
 * What the wallet saved about Hathor Next. All of it is public: the address, and the networks the
 * wallet was registered on. Its keys are never saved.
 *
 * @returns {{ address: string|null, registered: { [network: string]: true } }}
 */
export function loadSavedNext() {
  return {
    address: null,
    registered: {},
    ...(STORE.getItem(multichainKeyMap.next) ?? {}),
  };
}

/**
 * @param {Object} patch Part of what loadSavedNext returns
 */
export function saveNext(patch) {
  STORE.setItem(multichainKeyMap.next, { ...loadSavedNext(), ...patch });
}

/**
 * Whether this wallet used Hathor Next before, so its keys are prepared at every unlock and
 * loading Hathor Next needs no PIN or passkey.
 *
 * @returns {boolean}
 */
export function hasUsedNext() {
  return Boolean(loadSavedNext().address);
}

/**
 * Derives the wallet's Hathor Next keys from its words into the running client, and saves the
 * address they give. The caller drops the words.
 *
 * @param {string} words
 * @returns {string} The Hathor Next address
 */
export function prepareNextKeys(words) {
  const { address } = ensureNextClient().prepareKeys({ words });
  saveNext({ address });
  return address;
}

/**
 * At an unlock, with the words the PIN or the passkey gave: derives the Hathor Next keys if the
 * wallet used Hathor Next before. It never throws, so it can't fail an unlock.
 *
 * @param {string} words
 * @returns {string|null} The Hathor Next address, or null when nothing was derived
 */
export function prepareNextKeysAtUnlock(words) {
  if (!hasUsedNext()) {
    return null;
  }
  try {
    return prepareNextKeys(words);
  } catch (e) {
    log.error('Could not derive the Hathor Next keys at unlock.', e);
    return null;
  }
}
