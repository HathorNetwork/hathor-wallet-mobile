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
 * @param {number} amount
 *
 * @returns {'sent'|'received'}
 */
function getAmountType(amount) {
  if (amount < 0) {
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
 * It renders the item of actions list of a Nano Contract transaction.
 *
 * @param {Object} props
 * @param {Object} props.item An action item
 * @param {number} props.index position in the list
 */
export const NanoContractTransactionActionListItem = ({ item, index }) => {
  const tokens = useSelector((state) => state.tokens) || {};
  const tokenSymbol = getTokenSymbol(item.token, tokens);
  const amountType = getAmountType(item.amount);
  const tokensMetadata = useSelector((state) => state.tokenMetadata);
  const isNft = isTokenNFT(item.token, tokensMetadata);

  return (
    <Wrapper index={index}>
      <Icon type={amountType} />
      <ContentWrapper tokenSymbol={tokenSymbol} amountType={amountType} />
      <TokenAmount amount={item.amount} isNft={isNft} />
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
 * @param {Object} props
 * @property {string} props.tokenSymbol The symbol that represents a token
 * @property {'sent'|'received'} props.amountType The type of amount, either 'sent' or 'received'
 */
const ContentWrapper = ({ tokenSymbol, amountType }) => {
  const contentMap = {
    sent: t`Sent ${tokenSymbol}`,
    received: t`Received ${tokenSymbol}`,
  };

  return (
    <View style={styles.contentWrapper}>
      <Text style={[styles.text, styles.property]}>{contentMap[amountType]}</Text>
    </View>
  );
};

/**
 * It presents the token's amount using the right style.
 *
 * @param {Object} props
 * @param {number} props.amount
 * @param {boolean} props.isNft
 */
const TokenAmount = ({ amount, isNft }) => {
  const isReceivedType = getAmountType(amount) === 'received';
  const amountToRender = renderValue(amount, isNft);

  return (
    <View style={styles.amountWrapper}>
      <Text style={[
        styles.amount,
        isReceivedType && styles.amountReceived,
      ]}
      >
        {amountToRender}
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
  amountWrapper: {
    marginLeft: 'auto',
  },
  amount: {
    fontSize: 16,
    lineHeight: 20,
  },
  amountReceived: {
    color: 'hsla(180, 85%, 34%, 1)',
    fontWeight: 'bold',
  },
});
