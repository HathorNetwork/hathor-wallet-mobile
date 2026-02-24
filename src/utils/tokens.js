/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  newToken,
  tokenFetchBalanceRequested,
  fetchTokensMetadata,
  tokenMetadataUpdated,
} from '../actions';

/**
 * Registers a token in the wallet storage and Redux store.
 * This helper ensures all necessary registration steps are performed:
 * 1. Persists the token to wallet storage
 * 2. Dispatches newToken action to add token to Redux state
 * 3. Dispatches tokenFetchBalanceRequested to fetch the token balance
 *
 * @param {Object} wallet - The HathorWallet instance
 * @param {Function} dispatch - Redux dispatch function
 * @param {Object} token - Token object with uid, name, and symbol properties
 */
export const registerToken = async (wallet, dispatch, token) => {
  await wallet.storage.registerToken(token);
  dispatch(newToken(token));
  // Force fetch to avoid returning stale cached data (e.g., after a token swap)
  dispatch(tokenFetchBalanceRequested(token.uid, true));
};

/**
 * Fetches token metadata from the network and updates the Redux store.
 *
 * @param {Object} wallet - The HathorWallet instance
 * @param {Function} dispatch - Redux dispatch function
 * @param {string[]} tokenUids - Array of token UIDs to fetch metadata for
 */
export const updateTokensMetadata = async (wallet, dispatch, tokenUids) => {
  const networkName = wallet.getNetworkObject().name;
  const metadatas = await fetchTokensMetadata(tokenUids, networkName);
  dispatch(tokenMetadataUpdated(metadatas));
};
