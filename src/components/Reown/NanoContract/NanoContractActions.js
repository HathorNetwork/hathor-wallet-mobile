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
import { HathorFlatList } from '../../HathorFlatList';
import { commonStyles } from '../theme';
import { getShortHash, isTokenNFT, renderValue } from '../../../utils';
import { ReceivedIcon } from '../../Icons/Received.icon';
import { SentIcon } from '../../Icons/Sent.icon';
import { AlertUI, COLORS } from '../../../styles/themes';
import { DEFAULT_TOKEN } from '../../../constants';
import { WarnTextValue } from '../../WarnTextValue';
import { CircleError } from '../../Icons/CircleError.icon';

/**
 * It returns the title template for each action type,
 * which is either 'deposit' or 'withdrawal'.
 *
 * @param {string} tokenSymbol The token symbol fetched from metadata,
 * or a shortened token hash.
 *
 * @returns {string} A title template by action type.
 */
const actionTitleMap = (tokenSymbol) => ({
  deposit: t`${tokenSymbol} Deposit`,
  withdrawal: t`${tokenSymbol} Withdrawal`,
});

/**
 * Get action title depending on the action type.
 * @param {Object} tokens A map of token metadata by token uid
 * @param {Object} action An action object
 *
 * @returns {string} A formatted title to be used in the action card
 *
 * @example
 * getActionTitle({ '123': { ..., symbol: 'STR' }}, { ..., token: '123', type: 'deposit' })
 * >>> 'STR Deposit'
 *
 * @example
 * getActionTitle({}, { ..., token: '1234...5678', type: 'deposit' })
 * >>> '1234...5678 Deposit'
 */
const getActionTitle = (tokens, action) => {
  const tokenMetadata = tokens[action.token];
  if (tokenMetadata) {
    return actionTitleMap(tokenMetadata.symbol)[action.type];
  }

  if (action.token === DEFAULT_TOKEN.uid) {
    return actionTitleMap(DEFAULT_TOKEN.symbol)[action.type]
  }

  return actionTitleMap(getShortHash(action.token))[action.type];
};

/**
 * It renders a list of actions with a proper title for each one.
 * It renders nothing if there aren't actions to render.
 *
 * @param {Object} props
 * @param {Object[]} props.ncActions A list of Nano Contract actions.
 * @param {Object} props.tokens A map of token metadata by token uid.
 * @param {string} props.error A feedback error for tokens not loaded.
 */
export const NanoContractActions = ({ ncActions, tokens, error }) => {
  if (!ncActions || ncActions.length < 1) {
    return null;
  }

  const tokenMetadata = useSelector((state) => state.tokenMetadata);
  // A callback to check if the action token is an NFT.
  const isNft = useCallback(
    (token) => isTokenNFT(token, tokenMetadata),
    [tokenMetadata]
  );
  // A callback to retrieve the action title by its token symbol of hash.
  const getTitle = useCallback(
    (action) => getActionTitle(tokens, action),
    [tokens]
  );

  const styles = StyleSheet.create({
    wrapper: { marginTop: 0, marginBottom: 0, marginHorizontal: 0 },
  });

  return (
    <View>
      <View>
        <Text style={commonStyles.sectionTitle}>{t`Action List`}</Text>
      </View>
      <HathorFlatList
        scrollEnabled={false} // it avoids nearest scrolls
        wrapperStyle={styles.wrapper}
        data={ncActions}
        renderItem={({ item }) => (
          <ActionItem action={item} isNft={isNft(item.token)} title={getTitle(item)} />
        )}
        // If has error, shows the feedback error message in the list header.
        ListHeaderComponent={error && (
          <View style={[commonStyles.cardSplit, commonStyles.feedbackItem]}>
            <CircleError color={AlertUI.darkColor} size={24} />
            <View style={commonStyles.cardSplitContent}>
              <WarnTextValue>{error}</WarnTextValue>
            </View>
          </View>
        )}
      />
    </View>
  );
};

/**
 * @param {Object} props
 * @param {{
 *   type: 'deposit'|'withdrawal';
 *   token: string;
 *   amount: number;
 *   address: string;
 * }} props.action A transaction's action object
 * @param {boolean} props.isNft A flag to inform if the token is an NFT or not
 * @param {string} props.title The card title for the action
 */
const ActionItem = ({ action, title, isNft }) => {
  const styles = StyleSheet.create({
    action: [commonStyles.text, commonStyles.bold],
    valueLabel: [commonStyles.text, commonStyles.field, commonStyles.bold, commonStyles.mb4],
    value: [commonStyles.text, commonStyles.field],
  });

  return (
    <View style={[commonStyles.cardSplit, commonStyles.listItem]}>
      <Icon type={action.type} />
      <View style={commonStyles.cardSplitContent}>
        <Text style={styles.action}>{title}</Text>
        {action.address
          && (
            <View>
              <Text style={styles.valueLabel}>{t`To Address:`}</Text>
              <Text style={styles.value}>{action.address}</Text>
            </View>
          )}
      </View>
      <Amount amount={action.amount} isNft={isNft} />
    </View>
  )
}

/**
 * It renders an icon by action type, either 'deposit' or 'withdrawal'.
 *
 * @param {Object} props
 * @param {'deposit'|'withdrawal'} props.type Action type.
 */
const Icon = ({ type }) => {
  const iconMap = {
    deposit: SentIcon({ type: 'default' }),
    withdrawal: ReceivedIcon({ type: 'default' }),
  };

  return (iconMap[type]);
};

/**
 * It renders an amount with the right format.
 *
 * @param {Object} props
 * @param {bigint} props.amount The token amount as BigInt
 * @param {boolean} props.isNft
 */
const Amount = ({ amount, isNft }) => {
  const amountToRender = renderValue(amount, isNft);

  const styles = StyleSheet.create({
    wrapper: {
      marginLeft: 'auto',
    },
    amount: {
      fontSize: 16,
      lineHeight: 20,
      color: COLORS.black,
    },
  });

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.amount]}>
        {amountToRender}
      </Text>
    </View>
  )
};
