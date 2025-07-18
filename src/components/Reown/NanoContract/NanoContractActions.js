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
import { NanoContractActionType } from '@hathor/wallet-lib';
import { HathorFlatList } from '../../HathorFlatList';
import { commonStyles } from '../theme';
import { isTokenNFT, renderValue } from '../../../utils';
import { AlertUI, COLORS } from '../../../styles/themes';
import { WarnTextValue } from '../../WarnTextValue';
import { CircleError } from '../../Icons/CircleError.icon';
import {
  getActionTitle,
  isAuthorityAction,
  splitAuthorityTitle,
} from '../../NanoContract/common/NanoContractActionUtils';
import { NanoContractActionIcon } from '../../NanoContract/common/NanoContractActionIcon';

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
 *   type: 'deposit'|'withdrawal'|'grant_authority'|'acquire_authority';
 *   token: string;
 *   amount?: number;
 *   address?: string;
 *   authority?: string;
 *   authorityAddress?: string;
 *   changeAddress?: string;
 * }} props.action A transaction's action object
 * @param {boolean} props.isNft A flag to inform if the token is an NFT or not
 * @param {string} props.title The card title for the action
 */
const ActionItem = ({ action, title, isNft }) => {
  const styles = StyleSheet.create({
    action: [commonStyles.text, commonStyles.bold],
    authorityRow: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    authorityTitle: [commonStyles.text, commonStyles.bold],
    authorityType: [commonStyles.text, commonStyles.bold, { color: COLORS.textColorShadow }],
    valueLabel: [commonStyles.text, commonStyles.field, commonStyles.bold, commonStyles.mb4],
    value: [commonStyles.text, commonStyles.field],
    addressSection: {
      marginTop: 8,
    },
    contentWrapper: {
      flex: 1,
    },
  });

  // For authority actions, split the title to show authority type on the right
  const isAuthority = isAuthorityAction(action.type);
  const titleParts = isAuthority ? splitAuthorityTitle(title) : null;

  return (
    <View style={[commonStyles.cardSplit, commonStyles.listItem]}>
      <NanoContractActionIcon type={action.type} />
      <View style={[commonStyles.cardSplitContent, styles.contentWrapper]}>
        {isAuthority && titleParts ? (
          <View style={styles.authorityRow}>
            <Text style={styles.authorityTitle}>{titleParts[0]}</Text>
            <Text style={styles.authorityType}>{titleParts[1]}</Text>
          </View>
        ) : (
          <Text style={styles.action}>{title}</Text>
        )}

        {/* WITHDRAWAL: Show only address (address to send the amount and create the output) */}
        {action.type === NanoContractActionType.WITHDRAWAL
          && action.address && (
            <View style={styles.addressSection}>
              <Text style={styles.valueLabel}>{t`Address to send amount:`}</Text>
              <Text style={styles.value}>{action.address}</Text>
            </View>
        )}

        {/* DEPOSIT: Show address (to filter UTXOs) and changeAddress (change address) */}
        {action.type === NanoContractActionType.DEPOSIT && (
          <View style={[(action.address || action.changeAddress) && styles.addressSection]}>
            {action.address && (
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.valueLabel}>{t`Address to filter UTXOs:`}</Text>
                <Text style={styles.value}>{action.address}</Text>
              </View>
            )}
            {action.changeAddress && (
              <View>
                <Text style={styles.valueLabel}>{t`Change address:`}</Text>
                <Text style={styles.value}>{action.changeAddress}</Text>
              </View>
            )}
          </View>
        )}

        {/* GRANT_AUTHORITY: Show address (filter UTXOs) and authorityAddress (send authority) */}
        {action.type === NanoContractActionType.GRANT_AUTHORITY && (
          <View style={[(action.address || action.authorityAddress) && styles.addressSection]}>
            {action.address && (
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.valueLabel}>{t`Address to filter UTXOs:`}</Text>
                <Text style={styles.value}>{action.address}</Text>
              </View>
            )}
            {action.authorityAddress && (
              <View>
                <Text style={styles.valueLabel}>{t`Address to send new authority:`}</Text>
                <Text style={styles.value}>{action.authorityAddress}</Text>
              </View>
            )}
          </View>
        )}

        {/* ACQUIRE_AUTHORITY: Show only address (send the authority and create the output) */}
        {action.type === NanoContractActionType.ACQUIRE_AUTHORITY && action.address && (
          <View style={styles.addressSection}>
            <Text style={styles.valueLabel}>{t`Address to send authority:`}</Text>
            <Text style={styles.value}>{action.address}</Text>
          </View>
        )}
      </View>

      {/* Show amount for deposit/withdrawal actions */}
      {action.type !== NanoContractActionType.GRANT_AUTHORITY
        && action.type !== NanoContractActionType.ACQUIRE_AUTHORITY
        && action.amount != null && action.amount !== undefined && (
          <Amount amount={action.amount} isNft={isNft} />
      )}
    </View>
  )
}

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
      marginRight: 0,
      paddingRight: 16,
    },
    amount: {
      fontSize: 16,
      lineHeight: 20,
      color: COLORS.black,
      textAlign: 'right',
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
