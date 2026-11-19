/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { mintScaleOf } from './amount';
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
  const mintScale = useSelector((state) => mintScaleOf(selectSideChainConfig(state)));

  return useMemo(() => combinedTokenList({
    hathorTokens,
    hathorBalances,
    hathorDecimalPlaces,
    nextTokens,
    nextBalances,
    tokenMap,
    nativeTokenId,
    transfers,
    mintScale,
  }), [
    hathorTokens,
    hathorBalances,
    hathorDecimalPlaces,
    nextTokens,
    nextBalances,
    tokenMap,
    nativeTokenId,
    transfers,
    mintScale,
  ]);
}

/**
 * Keeps a screen open while `hold` is true: the header's back, Android's back button and the
 * swipe all stay where they are. A payment or transfer being decided shows its outcome there,
 * and leaving would reset what decides it.
 *
 * @param {Object} navigation The screen's navigation
 * @param {boolean} hold
 */
export function useHoldScreen(navigation, hold) {
  const holding = useRef(hold);
  holding.current = hold;
  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (holding.current) {
      e.preventDefault();
    }
  }), [navigation]);
  useEffect(() => {
    navigation.setOptions?.({ gestureEnabled: !hold });
  }, [navigation, hold]);
}
