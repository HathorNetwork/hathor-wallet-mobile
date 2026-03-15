/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants as hathorLibConstants } from '@hathor/wallet-lib';
import { STORE } from '../store';
import { networkSettingsKeyMap } from '../constants';

/**
 * Save the current registered tokens (excluding native token) to the network tokens storage
 * keyed by the current genesis hash, so they persist across network changes.
 *
 * @param {Object} wallet - The HathorWallet instance
 */
export async function saveCurrentTokensForNetwork(wallet) {
  const networkSettings = STORE.getItem(networkSettingsKeyMap.networkSettings);
  const genesisHash = networkSettings?.genesisHash;
  if (!genesisHash) return;
  if (!wallet) return;

  const htrUid = hathorLibConstants.NATIVE_TOKEN_UID;
  const tokens = {};
  const iterator = wallet.storage.getRegisteredTokens();
  let next = await iterator.next();
  while (!next.done) {
    const token = next.value;
    if (token.uid !== htrUid) {
      tokens[token.uid] = { uid: token.uid, name: token.name, symbol: token.symbol };
    }
    // eslint-disable-next-line no-await-in-loop
    next = await iterator.next();
  }

  STORE.saveTokensForNetwork(genesisHash, tokens);
}
