/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState } from 'react';
import { constants } from '@hathor/wallet-lib';

/**
 * Custom hook to manage token information and unregistered token modal
 *
 * @param {Object} registeredTokens - Object containing registered tokens
 * @param {Object} knownTokens - Object containing all known tokens (registered + unregistered)
 * @returns {Object} Token info utilities
 */
export const useTokenInfo = (registeredTokens, knownTokens) => {
  const [showTokenInfoModal, setShowTokenInfoModal] = useState(false);
  const [selectedTokenInfo, setSelectedTokenInfo] = useState(null);

  /**
   * Check if a token is registered in the wallet
   * @param {string} tokenId - The token UID to check
   * @returns {boolean} Whether the token is registered
   */
  const isTokenRegistered = (tokenId) => {
    // Native token is always registered
    if (tokenId === constants.NATIVE_TOKEN_UID) {
      return true;
    }
    // Check if token exists in registered tokens (not unregistered)
    return !!registeredTokens[tokenId];
  };

  /**
   * Show token info modal for a given token
   * @param {string} tokenId - The token UID to show info for
   */
  const showTokenInfo = (tokenId) => {
    const token = knownTokens[tokenId];
    if (token) {
      setSelectedTokenInfo({
        name: token.name,
        symbol: token.symbol,
        uid: tokenId,
      });
      setShowTokenInfoModal(true);
    }
  };

  /**
   * Close the token info modal
   */
  const closeTokenInfo = () => {
    setShowTokenInfoModal(false);
  };

  return {
    showTokenInfoModal,
    selectedTokenInfo,
    isTokenRegistered,
    showTokenInfo,
    closeTokenInfo,
  };
};

export default useTokenInfo;
