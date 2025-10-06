/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';

import HathorHeader from '../components/HathorHeader';
import TokenSelect from '../components/TokenSelect';
import { tokenSwapSetInputToken, tokenSwapSetOutputToken } from '../actions';

/**
 * @param {'input'|'output'} direction If the token chosen will be the swap input or output.
 * @returns A component to select a token from the list of the wallet tokens with balance.
 */
export default function TokenSwapTokenList(direction) {
  return () => {
    const dispatch = useDispatch();
    const navigation = useNavigation();
    const route = useRoute();
    const token = route.params.token ?? null;

    const tokenMetadata = useSelector(state => state.tokenMetadata);
    const tokensBalance = useSelector(state => state.tokensBalance);
    const allowedTokens = useSelector(state => state.tokenSwap.allowedTokens);

    const onItemPress = (item) => {
      if (direction === 'input') {
        dispatch(tokenSwapSetInputToken(item));
      } else if (direction === 'output') {
        dispatch(tokenSwapSetOutputToken(item))
      }
      navigation.goBack();
    };

    const Header = () => {
      <HathorHeader title='TOKENS' onBackPress={() => navigation.goBack()} />
    }

    return (
      <TokenSelect
        header={<Header />}
        onItemPress={onItemPress}
        selectedToken={token}
        tokens={allowedTokens}
        tokensBalance={tokensBalance}
        tokenMetadata={tokenMetadata}
      />
    );
  };
}
