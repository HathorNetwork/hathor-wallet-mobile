/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectSideChainConfig, selectTokenMap } from './gating';
import { combinedTokenList } from './tokens';

/**
 * The Dashboard's list of both chains (combinedTokenList), from the state.
 *
 * @returns {Object[]}
 */
export function useCombinedTokens() {
  const hathorTokens = useSelector((state) => state.tokens);
  const hathorBalances = useSelector((state) => state.tokensBalance);
  const hathorDecimalPlaces = useSelector((state) => state.serverInfo?.decimal_places ?? 2);
  const nextTokens = useSelector((state) => state.multichain.next.tokens);
  const nextBalances = useSelector((state) => state.multichain.next.balances);
  const transfers = useSelector((state) => state.multichain.transfers);
  const tokenMap = useSelector(selectTokenMap);
  const nativeTokenId = useSelector((state) => selectSideChainConfig(state)?.nativeTokenId);

  return useMemo(() => combinedTokenList({
    hathorTokens,
    hathorBalances,
    hathorDecimalPlaces,
    nextTokens,
    nextBalances,
    tokenMap,
    nativeTokenId,
    transfers,
  }), [
    hathorTokens,
    hathorBalances,
    hathorDecimalPlaces,
    nextTokens,
    nextBalances,
    tokenMap,
    nativeTokenId,
    transfers,
  ]);
}
