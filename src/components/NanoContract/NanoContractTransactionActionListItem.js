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
import { NanoContractActionType } from '@hathor/wallet-lib';
import { NANO_CONTRACT_ACTION } from '../../constants';
import { COLORS } from '../../styles/themes';
import { getShortHash, isTokenNFT, renderValue } from '../../utils';
import { ReceivedIcon } from '../Icons/Received.icon';
import { SentIcon } from '../Icons/Sent.icon';
import { DEFAULT_TOKEN } from '../../constants';

/**
 * It returns the title template for each action type,
 * which includes 'deposit', 'withdrawal', 'grant_authority', and 'acquire_authority'.
 *
 * @param {string} tokenSymbol The token symbol fetched from metadata,
 * or a shortened token hash.
 *
 * @returns {string} A title template by action type.
 */
const actionTitleMap = (tokenSymbol) => ({
  [NanoContractActionType.DEPOSIT]: t`${tokenSymbol} Deposit`,
  [NanoContractActionType.WITHDRAWAL]: t`${tokenSymbol} Withdrawal`,
  [NanoContractActionType.GRANT_AUTHORITY]: t`${tokenSymbol} Grant Authority`,
  [NanoContractActionType.ACQUIRE_AUTHORITY]: t`${tokenSymbol} Acquire Authority`,
});

/**
 * Get action title depending on the action type.
 * @param {Object} tokens A map of token metadata by token uid
 * @param {Object} action An action object
 *
 * @returns {string} A formatted title to be used in the action card
 */
const getActionTitle = (tokens, action) => {
  const tokenMetadata = tokens[action.uid];
  let tokenSymbol;

  if (tokenMetadata) {
    tokenSymbol = tokenMetadata.symbol;
  } else if (action.uid === DEFAULT_TOKEN.uid) {
    tokenSymbol = DEFAULT_TOKEN.symbol;
  } else {
    tokenSymbol = getShortHash(action.uid);
  }

  // For authority actions, include the authority type in the title
  if (action.type === NanoContractActionType.GRANT_AUTHORITY
    || action.type === NanoContractActionType.ACQUIRE_AUTHORITY) {
    const baseTitle = actionTitleMap(tokenSymbol)[action.type];
    return action.authority ? `${baseTitle}: ${action.authority}` : baseTitle;
  }

  return actionTitleMap(tokenSymbol)[action.type];
};

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
export const NanoContractTransactionActionListItem = ({ item, txMetadata }) => {
  const knownTokens = useSelector((state) => ({ ...state.tokens, ...state.unregisteredTokens }));
  const isNft = useSelector(checkIsTokenNft(item.uid));
  
  // Merge known tokens with transaction-specific metadata
  const mergedTokens = { ...knownTokens, ...txMetadata };
  const title = getActionTitle(mergedTokens, item);

  const isAuthorityAction = item.type === NanoContractActionType.GRANT_AUTHORITY 
    || item.type === NanoContractActionType.ACQUIRE_AUTHORITY;

  return (
    <Wrapper>
      <Icon type={item.type} />
      <ContentWrapper title={title} type={item.type} isAuthorityAction={isAuthorityAction} />
      {(item.type === NanoContractActionType.DEPOSIT || item.type === NanoContractActionType.WITHDRAWAL) && (
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
 * It renders the balance icon, either sent or received.
 *
 * @param {Object} props
 * @param {'deposit'|'withdrawal'|'grant_authority'|'acquire_authority'} props.type An action type
 */
const Icon = ({ type }) => {
  const iconMap = {
    [NanoContractActionType.DEPOSIT]: SentIcon({ type: 'default' }),
    [NanoContractActionType.WITHDRAWAL]: ReceivedIcon({ type: 'default' }),
    [NanoContractActionType.GRANT_AUTHORITY]: SentIcon({ type: 'default' }),
    [NanoContractActionType.ACQUIRE_AUTHORITY]: ReceivedIcon({ type: 'default' }),
  };

  return (iconMap[type]);
};

/**
 * Renders item core content.
 *
 * @param {Object} props
 * @property {string} props.title The formatted title for the action
 * @property {'deposit'|'withdrawal'|'grant_authority'|'acquire_authority'} props.type An action type
 * @property {boolean} props.isAuthorityAction Whether this is an authority action
 */
const ContentWrapper = ({ title, type, isAuthorityAction }) => {
  const titleParts = isAuthorityAction && title.includes(':') ? title.split(':') : null;

  return (
    <View style={[styles.contentWrapper, isAuthorityAction && styles.authorityContentWrapper]}>
      {isAuthorityAction && titleParts ? (
        <View style={styles.authorityRow}>
          <Text style={[styles.text, styles.property]}>{titleParts[0].trim()}</Text>
          <Text style={[styles.text, styles.property, styles.authorityType]}>{titleParts[1].trim()}</Text>
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
  const amountToRender = renderValue(amount ?? 0, isNft);

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
