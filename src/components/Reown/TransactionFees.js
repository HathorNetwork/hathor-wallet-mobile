/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { t } from 'ttag';
import { constants } from '@hathor/wallet-lib';
import { HathorFlatList } from '../HathorFlatList';
import { commonStyles } from './theme';
import { renderValue } from '../../utils';
import { SentIcon } from '../Icons/Sent.icon';
import { COLORS } from '../../styles/themes';

const styles = StyleSheet.create({
  wrapper: { marginTop: 0, marginBottom: 0, marginHorizontal: 0 },
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

/**
 * Renders a list of network fees with icon, token symbol, and amount.
 * Returns null if there are no fees to render.
 *
 * @param {Object} props
 * @param {bigint} props.fee fee amount
 */
export const TransactionFees = ({ fee }) => {
  if (!fee) {
    return null;
  }

  return (
    <View>
      <Text style={commonStyles.sectionTitle}>{t`Network Fee`}</Text>
      <HathorFlatList
        scrollEnabled={false} // it avoids nearest scrolls
        wrapperStyle={styles.wrapper}
        data={[fee]}
        renderItem={({ item }) => (
          <FeeItem
            fee={item}
            symbol={constants.DEFAULT_NATIVE_TOKEN_CONFIG.symbol}
            isNft={false}
          />
        )}
        keyExtractor={(item, index) => `fee-${index}`}
      />
    </View>
  );
};

/**
 * Renders a single fee item with icon, symbol, and amount.
 *
 * @param {Object} props
 * @param {bigint} props.fee Fee amount
 * @param {string} props.symbol Token symbol to display
 * @param {boolean} props.isNft Whether the token is an NFT
 */
const FeeItem = ({ fee, symbol, isNft }) => {
  const amountToRender = renderValue(fee, isNft);

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
