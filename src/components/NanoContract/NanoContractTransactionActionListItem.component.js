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
import { ReceivedIcon } from '../Icons/Received.icon';
import { SentIcon } from '../Icons/Sent.icon';

/**
 * It returns either 'sent' or 'received' depending on value.
 *
 * @param {number} value
 *
 * @returns {'sent'|'received'}
 */
function getBalanceType(value) {
  if (value < 0) {
    return 'sent';
  }
  return 'received';
}

/**
 * Retrives token symbol, otherwise returns a shortened token hash.
 *
 * @param {string} tokenUid Token hash
 * @param {Object[]} tokens Registered tokens from redux store
 */
function getTokenSymbol(tokenUid, tokens) {
  const registeredToken = Object.values(tokens).filter((token) => token.uid === tokenUid).pop();
  if (registeredToken) {
    return registeredToken.symbol;
  }
  return getShortHash(tokenUid, 7);
}

/**
 * It renders the item of Nano Contract Transactions List.
 *
 * @param {Object} props
 * @param {Object} props.item registered Nano Contract data
 * @param {number} props.index position in the list
 */
export const NanoContractTransactionActionListItem = ({ item, index }) => {
  const balance = item.available + item.locked;
  const tokens = useSelector((state) => state.tokens) || {};
  const tokenValue = getTokenSymbol(item.tokenUid, tokens);
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

/**
 * It renders the balance icon, either sent or received.
 *
 * @param {Object} props
 * @param {'sent'|'received'} props.type
 */
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

/**
 * It presents the balance value using the right style.
 *
 * @param {Object} props
 * @param {number} props.balance
 * @param {boolean} props.isNft
 */
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
