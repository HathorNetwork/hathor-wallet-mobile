/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useSelector } from 'react-redux';
import { StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import moment from 'moment';
import { t } from 'ttag';
import IconTabBar from '../../icon-font';
import { renderNextValue } from '../../multichain/amount';
import { nextStatusLabel } from '../../multichain/content';
import { COLORS } from '../../styles/themes';

/**
 * A long address with both ends kept, so it can still be checked.
 *
 * @param {string} address
 * @returns {string}
 */
export const middleTruncate = (address) => (
  address.length > 18 ? `${address.slice(0, 10)}…${address.slice(-6)}` : address
);

/**
 * What a Hathor Next row says it is. An incoming payment has no sender: Hathor Next can't know
 * who paid. A fee is a row of its own, never added to the payment it bought.
 *
 * @param {Object} row A Hathor Next Tx row
 * @returns {string}
 */
export function nextRowTitle(row) {
  if (row.kind === 'fee') {
    return t`Fee`;
  }
  if (row.direction === 'in') {
    return t`Received`;
  }
  if (!row.peer) {
    return t`Sent`;
  }
  const peer = middleTruncate(row.peer);
  return t`Sent to ${peer}`;
}

/**
 * A Hathor Next transaction row of a token's history.
 *
 * @param {Object} props
 * @param {Object} props.row A Hathor Next Tx row
 * @param {string} props.amountFormat
 * @param {Function} props.onPress
 * @param {React.ReactNode} [props.accessory] Shown under the row's details: its chain's mark, where
 *   rows of both chains mix
 */
export const NextTxRow = ({ row, amountFormat, onPress, accessory = null }) => {
  const incoming = row.direction === 'in';
  const failed = row.status === 'failed';
  const hathorDecimalPlaces = useSelector((state) => state.serverInfo?.decimal_places ?? 2);
  const amount = renderNextValue(BigInt(row.amount), hathorDecimalPlaces, amountFormat);
  const signed = `${incoming ? '' : '-'}${amount}`;
  const status = row.status === 'recorded' ? null : nextStatusLabel(row.status);
  return (
    <TouchableHighlight onPress={() => onPress(row)} underlayColor={COLORS.primaryOpacity30}>
      <View style={styles.row}>
        <IconTabBar
          style={[styles.icon, failed && styles.disabled]}
          color={incoming ? COLORS.positiveBalanceColor : COLORS.textColor}
          size={24}
          name={incoming ? 'icReceive' : 'icSend'}
        />
        <View style={styles.middle}>
          <Text style={[styles.title, failed && styles.failedText]} numberOfLines={1}>
            {nextRowTitle(row)}
          </Text>
          <Text style={styles.secondary}>{moment(row.at).calendar()}</Text>
          {status && (
            <Text style={[styles.secondary, styles.bold, failed && styles.failedStatus]}>
              {status}
            </Text>
          )}
          {accessory}
        </View>
        <Text
          style={[
            styles.amount,
            incoming && styles.positive,
            failed && styles.failedAmount,
          ]}
          numberOfLines={1}
        >
          {signed}
        </Text>
      </View>
    </TouchableHighlight>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 80,
    paddingVertical: 24,
  },
  icon: {
    marginLeft: 16,
    marginRight: 16,
    width: 24,
    height: 24,
  },
  disabled: {
    opacity: 0.3,
  },
  middle: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 'bold',
  },
  secondary: {
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.textColorShadow,
  },
  bold: {
    fontWeight: 'bold',
  },
  failedText: {
    color: COLORS.textColorShadowLight,
  },
  failedStatus: {
    color: COLORS.errorBgColor,
  },
  amount: {
    fontSize: 16,
    marginRight: 16,
    marginLeft: 8,
    maxWidth: '45%',
    textAlign: 'right',
  },
  positive: {
    color: COLORS.positiveBalanceColor,
    fontWeight: 'bold',
  },
  failedAmount: {
    color: COLORS.textColorShadowLight,
    textDecorationLine: 'line-through',
    fontWeight: 'normal',
  },
});
