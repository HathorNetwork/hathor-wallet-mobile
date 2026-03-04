/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { t } from 'ttag';
import { useSelector } from 'react-redux';
import { constants } from '@hathor/wallet-lib';
import { HathorFlatList } from '../HathorFlatList';
import { commonStyles } from './theme';
import { isTokenNFT, renderValue } from '../../utils';
import { SentIcon } from '../Icons/Sent.icon';
import { COLORS } from '../../styles/themes';

/**
 * Renders a list of network fees with icon, token symbol, and amount.
 * Returns null if there are no fees to render.
 *
 * @param {Object} props
 * @param {Object[]} props.fees Array of fee objects { tokenIndex, token, amount }
 * @param {Object} props.tokens Map of token metadata by token uid
 */
export const TransactionFees = ({ fees, tokens }) => {
  const tokenMetadata = useSelector((state) => state.tokenMetadata);

  if (!fees || fees.length < 1) {
    return null;
  }

  const isNft = useCallback(
    (token) => isTokenNFT(token, tokenMetadata),
    [tokenMetadata]
  );

  const getTokenSymbol = useCallback(
    (fee) => {
      if (fee.tokenIndex === 0) {
        return constants.DEFAULT_NATIVE_TOKEN_CONFIG.symbol;
      }
      if (fee.token && tokens[fee.token]) {
        return tokens[fee.token].symbol;
      }
      return `Token ${fee.tokenIndex}`;
    },
    [tokens]
  );

  const styles = StyleSheet.create({
    wrapper: { marginTop: 0, marginBottom: 0, marginHorizontal: 0 },
  });

  return (
    <View>
      <View>
        <Text style={commonStyles.sectionTitle}>{t`Network Fee`}</Text>
      </View>
      <HathorFlatList
        scrollEnabled={false} // it avoids nearest scrolls
        wrapperStyle={styles.wrapper}
        data={fees}
        renderItem={({ item }) => (
          <FeeItem
            fee={item}
            symbol={getTokenSymbol(item)}
            isNft={isNft(item.token)}
          />
        )}
        keyExtractor={(item, index) => `fee-${item.tokenIndex}-${index}`}
      />
    </View>
  );
};

/**
 * Renders a single fee item with icon, symbol, and amount.
 *
 * @param {Object} props
 * @param {{ tokenIndex: number, token?: string, amount: bigint }} props.fee
 * @param {number} props.index
 * @param {string} props.symbol Token symbol to display
 * @param {boolean} props.isNft Whether the token is an NFT
 */
const FeeItem = ({ fee, symbol, isNft }) => {
  const styles = StyleSheet.create({
    symbol: [commonStyles.text, commonStyles.bold],
    amount: {
      marginLeft: 'auto',
      marginRight: 0,
      paddingRight: 16,
    },
    amountText: {
      fontSize: 16,
      lineHeight: 20,
      color: COLORS.black,
      textAlign: 'right',
    },
    contentWrapper: {
      flex: 1,
    },
  });

  const amountToRender = renderValue(fee.amount, isNft);

  return (
    <View style={[commonStyles.cardSplit, commonStyles.listItem]}>
      <SentIcon type='default' />
      <View style={[commonStyles.cardSplitContent, styles.contentWrapper]}>
        <Text style={styles.symbol}>{symbol}</Text>
      </View>
      <View style={styles.amount}>
        <Text style={styles.amountText}>{amountToRender}</Text>
      </View>
    </View>
  );
};
