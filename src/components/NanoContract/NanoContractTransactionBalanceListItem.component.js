/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  TouchableHighlight,
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import { COLORS } from '../../styles/themes';
import { getShortHash, isTokenNFT, renderValue } from '../../utils';
import { ReceivedIcon } from '../Icon/Received.icon';
import { SentIcon } from '../Icon/Sent.icon';

function getBalanceType(value) {
  if (value < 0) {
    return 'sent';
  }
  return 'received';
}

function getTokenValue(tokenUid, tokens) {
  const registeredToken = Object.values(tokens).filter((token) => token.uid === tokenUid).pop();
  if (registeredToken) {
    return registeredToken.symbol;
  }
  return getShortHash(tokenUid, 7);
}

/**
 * Renders each item of Nano Contract Transactions List.
 *
 * @param {Object} ncItem
 * @property {Object} ncItem.item registered Nano Contract data
 * @property {number} ncItem.index position in the list
 */
export const NanoContractTransactionBalanceListItem = ({ item, index }) => {
  const balance = item.available + item.locked;
  const tokens = useSelector((state) => state.tokens) || {};
  const tokenValue = getTokenValue(item.tokenUid, tokens);
  const type = getBalanceType(balance);
  const tokensMetadata = useSelector((state) => state.tokenMetadata);
  const isNft = isTokenNFT(item.tokenUid, tokensMetadata);

  return (
    <Wrapper index={index}>
      <Icon type={type} />
      <ContentWrapper tokenValue={tokenValue} type={type} />
      <BalanceValue balance={balance} isNft={isNft} />
    </Wrapper>
  );
};

const Wrapper = ({ index, children }) => {
  const isFirstItem = index === 0;
  return (
    <TouchableHighlight
      style={[isFirstItem && styles.firstItem]}
      underlayColor={COLORS.primaryOpacity30}
    >
      <View style={styles.wrapper}>{children}</View>
    </TouchableHighlight>
  );
};

const Icon = ({ type }) => {
  const iconMap = {
    sent: SentIcon({ type: 'default' }),
    received: ReceivedIcon({ type: 'default' }),
  };

  return (iconMap[type]);
};

/**
 * Renders item core content.
 *
 * @param {Object} ncItem
 * @property {Obeject} ncItem.nc registered Nano Contract data
 */
const ContentWrapper = ({ tokenValue, type }) => {
  const contentMap = {
    sent: t`Sent ${tokenValue}`,
    received: t`Received ${tokenValue}`,
  };

  return (
    <View style={styles.contentWrapper}>
      <Text style={[styles.text, styles.property]}>{contentMap[type]}</Text>
    </View>
  );
};

const BalanceValue = ({ balance, isNft }) => {
  const isReceivedType = getBalanceType(balance) === 'received';
  const balanceValue = renderValue(balance, isNft);

  return (
    <View style={styles.balanceWrapper}>
      <Text style={[
        styles.balance,
        isReceivedType && styles.balanceReceived,
      ]}
      >
        {balanceValue}
      </Text>
    </View>
  )
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    width: '100%',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  firstItem: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  contentWrapper: {
    maxWidth: '80%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginRight: 'auto',
    paddingHorizontal: 16,
  },
  icon: {
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 6,
    color: 'hsla(0, 0%, 38%, 1)',
  },
  property: {
    paddingBottom: 4,
    fontWeight: 'bold',
    color: 'black',
  },
  padding0: {
    paddingBottom: 0,
  },
  balanceWrapper: {
    marginLeft: 'auto',
  },
  balance: {
    fontSize: 16,
    lineHeight: 20,
  },
  balanceReceived: {
    color: 'hsla(180, 85%, 34%, 1)',
    fontWeight: 'bold',
  },
});
