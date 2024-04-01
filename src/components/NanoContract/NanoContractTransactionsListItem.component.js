/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { TouchableHighlight, StyleSheet, View, Text, Image } from 'react-native';
import { t } from 'ttag';

import chevronRight from '../../assets/icons/chevron-right.png';
import { COLORS } from '../../styles/themes';
import { getShortHash, getTimestampFormat } from '../../utils';

/**
 * Renders each item of Nano Contract Transactions List.
 *
 * @param {Object} ncItem
 * @property {Object} ncItem.item registered Nano Contract data
 * @property {number} ncItem.index position in the list
 */
export const NanoContractTransactionsListItem = ({ item, index, onPress }) => (
  <Wrapper index={index} onPress={onPress}>
    <ContentWrapper tx={item} />
    <ArrowRight />
  </Wrapper>
);

const Wrapper = ({ index, onPress, children }) => (
  <TouchableHighlight
    onPress={onPress}
    underlayColor={COLORS.primaryOpacity30}
  >
    <View style={styles.wrapper}>{children}</View>
  </TouchableHighlight>
);

/**
 * Renders item core content.
 *
 * @param {Object} ncItem
 * @property {Obeject} ncItem.nc registered Nano Contract data
 */
const ContentWrapper = ({ tx }) => (
  <View style={styles.contentWrapper}>
    <View style={styles.contentHeadline}>
      <Text
        style={[
          styles.text, styles.property, styles.padding0
        ]}
      >
        {getShortHash(tx.txId, 7)}
      </Text>
      {tx.isMine
        && (
        <View style={styles.headlineLabel}>
          <Text style={styles.isMineLabel}>{t`From this wallet`}</Text>
        </View>
        )}
    </View>
    <Text style={[styles.text]}>{tx.ncMethod}</Text>
    <Text style={[styles.text, styles.padding0]}>{getTimestampFormat(tx.timestamp)}</Text>
  </View>
);

const ArrowRight = () => (
  <View>
    <Image source={chevronRight} width={24} height={24} />
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentWrapper: {
    flexShrink: 1,
    maxWidth: '80%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginRight: 'auto',
    /* Add optical effect of simmetry with array icon */
    paddingLeft: 8,
  },
  contentHeadline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
  },
  headlineLabel: {
    marginLeft: 8,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 2,
    backgroundColor: COLORS.freeze100,
  },
  isMineLabel: {
    fontSize: 12,
    lineHeight: 20,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 6,
    color: 'hsla(0, 0%, 38%, 1)',
  },
  property: {
    fontWeight: 'bold',
    color: 'black',
  },
  padding0: {
    paddingBottom: 0,
  },
});
