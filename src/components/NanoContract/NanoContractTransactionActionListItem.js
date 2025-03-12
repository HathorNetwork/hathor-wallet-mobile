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
import { NANO_CONTRACT_ACTION } from '../../constants';
import { COLORS } from '../../styles/themes';
import { getShortHash, isTokenNFT, renderValue } from '../../utils';
import { ReceivedIcon } from '../Icons/Received.icon';
import { SentIcon } from '../Icons/Sent.icon';

/**
 * Retrieves token symbol, otherwise returns a shortened token hash.
 *
 * @param {string} tokenUid Token hash
 * @returns {(state) => boolean} Callback that takes state as input
 *
 * Remarks:
 * This function should be used combined with `useSelector`.
 */
function getTokenSymbol(tokenUid) {
  return (state) => {
    const tokens = state.tokens || {};
    if (tokenUid in tokens) {
      return tokens[tokenUid].symbol;
    }
    return getShortHash(tokenUid, 7);
  };
}

/**
 * Checks if the referred token is an NFT.
 *
 * @param {string} tokenUid Token hash
 * @returns {(state) => boolean} Callback that takes state as input
 *
 * Remarks:
 * This function should be used combined with `useSelector`.
 */
function checkIsTokenNft(tokenUid) {
  return (state) => isTokenNFT(tokenUid, state.tokenMetadata || {});
}

/**
 * It renders the item of actions list of a Nano Contract transaction.
 *
 * @param {Object} props
 * @param {{
 *   type: string;
 *   uid: string;
 *   amount: number;
 * }} props.item A transaction action
 */
export const NanoContractTransactionActionListItem = ({ item }) => {
  const tokenSymbol = useSelector(getTokenSymbol(item.uid));
  const isNft = useSelector(checkIsTokenNft(item.uid));

  return (
    <Wrapper>
      <Icon type={item.type} />
      <ContentWrapper tokenSymbol={tokenSymbol} type={item.type} />
      <TokenAmount amount={item.amount} isNft={isNft} type={item.type} />
    </Wrapper>
  );
};

const Wrapper = ({ children }) => (
  <TouchableHighlight underlayColor={COLORS.primaryOpacity30}>
    <View style={styles.wrapper}>{children}</View>
  </TouchableHighlight>
);

/**
 * It renders the balance icon, either sent or received.
 *
 * @param {Object} props
 * @param {'deposit'|'withdrawal'} props.type An action type
 */
const Icon = ({ type }) => {
  const iconMap = {
    deposit: SentIcon({ type: 'default' }),
    withdrawal: ReceivedIcon({ type: 'default' }),
  };

  return (iconMap[type]);
};

/**
 * Renders item core content.
 *
 * @param {Object} props
 * @property {string} props.tokenSymbol The symbol that represents a token
 * @property {'deposit'|'withdrawal'} props.type An action type
 */
const ContentWrapper = ({ tokenSymbol, type }) => {
  const contentMap = {
    deposit: t`Deposit ${tokenSymbol}`,
    withdrawal: t`Withdrawal ${tokenSymbol}`,
  };

  return (
    <View style={styles.contentWrapper}>
      <Text style={[styles.text, styles.property]}>{contentMap[type]}</Text>
    </View>
  );
};

/**
 * It presents the token's amount using the right style.
 *
 * @param {Object} props
 * @param {bigint} props.amount Action amount as BigInt
 * @param {boolean} props.isNft True when it is an NFT, false otherwise
 * @param {'deposit'|'withdrawal'} props.type An action type
 */
const TokenAmount = ({ amount, isNft, type }) => {
  const isReceivingToken = type === NANO_CONTRACT_ACTION.withdrawal;
  const amountToRender = renderValue(amount, isNft);

  return (
    <View style={styles.amountWrapper}>
      <Text style={[
        styles.amount,
        isReceivingToken && styles.amountReceived,
      ]}
      >
        {amountToRender}
      </Text>
    </View>
  );
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
  contentWrapper: {
    maxWidth: '80%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginRight: 'auto',
    paddingHorizontal: 16,
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
