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
import { HathorFlatList } from '../../HathorFlatList';
import { commonStyles } from '../theme';
import { getShortHash, renderValue } from '../../../utils';
import { ReceivedIcon } from '../../Icons/Received.icon';
import { SentIcon } from '../../Icons/Sent.icon';
import { COLORS } from '../../../styles/themes';
import { DEFAULT_TOKEN } from '../../../constants';

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
 *
 * @param {Object} props
 * @param {Object[]} props.ncActions A list of Nano Contract actions.
 * @param {Object} props.tokens A map of token metadata by token uid.
 */
export const NanoContractActions = ({ ncActions, tokens }) => {
  const styles = StyleSheet.create({
    wrapper: { marginTop: 0, marginBottom: 0, marginHorizontal: 0 },
    action: [commonStyles.text, commonStyles.bold],
    valueLabel: [commonStyles.text, commonStyles.value, commonStyles.bold, commonStyles.mb4],
    value: [commonStyles.text, commonStyles.value],
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
          <View style={[commonStyles.cardSplit, commonStyles.listItem]}>
            <Icon type={item.type} />
            <View style={commonStyles.cardSplitContent}>
              <Text style={styles.action}>{getActionTitle(tokens, item)}</Text>
              {item.address
                && (
                <View>
                  <Text style={styles.valueLabel}>{t`To Address:`}</Text>
                  <Text style={styles.value}>{item.address}</Text>
                </View>
                )}
            </View>
            <Amount amount={item.amount} isNft={false} />
          </View>
        )}
      />
    </View>
  );
};

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
 * @param {number} props.amount
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
