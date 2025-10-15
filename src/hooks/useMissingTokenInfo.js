/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useSelector } from 'react-redux';

/**
 * Custom hook to get combined token info from registered and unregistered tokens
 * Token details for unregistered tokens are now provided automatically by the RPC handler
 * @returns {Object} Combined tokens object with registered and unregistered tokens
 */
export const useMissingTokenInfo = () => {
  const knownTokens = useSelector((state) => ({ ...state.tokens, ...state.unregisteredTokens }));

  // Token details are now provided automatically by the RPC handler
  // via the tokenDetails map, so no need to manually request them

  return knownTokens;
};
