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
import { NanoContractActionType } from '@hathor/wallet-lib';
import { NANO_CONTRACT_ACTION } from '../../constants';
import { COLORS } from '../../styles/themes';
import { isTokenNFT, renderValue } from '../../utils';
import {
  getActionTitle,
  isAuthorityAction,
  splitAuthorityTitle,
} from './common/NanoContractActionUtils';
import { NanoContractActionIcon } from './common/NanoContractActionIcon';

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
export const NanoContractTransactionActionListItem = ({ item, txMetadata }) => {
  const knownTokens = useSelector((state) => ({ ...state.tokens, ...state.unregisteredTokens }));
  const isNft = useSelector(checkIsTokenNft(item.uid));

  // Merge known tokens with transaction-specific metadata
  const mergedTokens = { ...knownTokens, ...txMetadata };
  const title = getActionTitle(mergedTokens, item);

  const isAuthority = isAuthorityAction(item.type);

  return (
    <Wrapper>
      <NanoContractActionIcon type={item.type} />
      <ContentWrapper title={title} type={item.type} isAuthorityAction={isAuthority} />
      {(item.type === NanoContractActionType.DEPOSIT
        || item.type === NanoContractActionType.WITHDRAWAL) && (
          <TokenAmount amount={item.amount} isNft={isNft} type={item.type} />
      )}
    </Wrapper>
  );
};

const Wrapper = ({ children }) => (
  <TouchableHighlight underlayColor={COLORS.primaryOpacity30}>
    <View style={styles.wrapper}>{children}</View>
  </TouchableHighlight>
);

/**
 * Renders item core content.
 *
 * @param {Object} props
 * @property {string} props.title The formatted title for the action
 * @property {'deposit'|'withdrawal'|'grant_authority'|'acquire_authority'}
 * props.type An action type
 * @property {boolean} props.isAuthorityAction Whether this is an authority action
 */
const ContentWrapper = ({ title, isAuthorityAction: isAuthority }) => {
  const titleParts = isAuthority ? splitAuthorityTitle(title) : null;

  return (
    <View style={[styles.contentWrapper, isAuthority && styles.authorityContentWrapper]}>
      {isAuthority && titleParts ? (
        <View style={styles.authorityRow}>
          <Text style={[styles.text, styles.property]}>{titleParts[0]}</Text>
          <Text style={[styles.text, styles.property, styles.authorityType]}>{titleParts[1]}</Text>
        </View>
      ) : (
        <Text style={[styles.text, styles.property]}>{title}</Text>
      )}
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
    flex: 1,
  },
  authorityContentWrapper: {
    maxWidth: '100%',
    paddingRight: 16,
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
  authorityRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorityType: {
    color: COLORS.textColorShadow,
    textAlign: 'right',
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
