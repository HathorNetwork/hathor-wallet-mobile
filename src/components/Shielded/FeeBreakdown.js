/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { t } from 'ttag';

import { ChevronDownIcon } from '../Icons/ChevronDown.icon';
import { ChevronUpIcon } from '../Icons/ChevronUp.icon';
import { renderValue } from '../../utils';
import { COLORS } from '../../styles/themes';

/**
 * The fees of a tx: their total, which expands into the network fee and the privacy fee of its
 * shielded outputs. A fee of zero gets no row. Amounts are in the network's native token, with
 * its decimal places and the amount format.
 *
 * @param {Object} props
 * @param {bigint} props.total The tx's fee
 * @param {bigint} props.network Its network fee
 * @param {bigint} props.privacy Its privacy fee
 * @param {string} props.symbol The network's native token symbol
 * @param {number} props.decimalPlaces
 * @param {string} props.amountFormat
 * @param {Object} [props.style] The container's style
 * @param {Object} [props.rowStyle] The style of the row of the total
 */
export default function FeeBreakdown({
  total,
  network,
  privacy,
  symbol,
  decimalPlaces,
  amountFormat,
  style,
  rowStyle,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formatFee = (amount) => (
    `${renderValue(amount, false, decimalPlaces, amountFormat)} ${symbol}`
  );

  return (
    <View style={style}>
      <TouchableOpacity
        style={[styles.feeRow, rowStyle]}
        onPress={() => setIsExpanded((expanded) => !expanded)}
        activeOpacity={0.6}
      >
        <Text style={styles.feeRowLabel}>{t`Fees`}</Text>
        <View style={styles.feeRowValueWrapper}>
          <Text style={styles.feeRowValue}>{formatFee(total)}</Text>
          {isExpanded
            ? <ChevronUpIcon size={16} color={COLORS.textColor} />
            : <ChevronDownIcon size={16} color={COLORS.textColor} />}
        </View>
      </TouchableOpacity>
      {isExpanded && (
        <View style={styles.feeBreakdown}>
          {network > 0n && (
            <View style={styles.feeBreakdownRow}>
              <Text style={styles.feeBreakdownLabel}>{t`Network fee`}</Text>
              <Text style={styles.feeBreakdownValue}>{formatFee(network)}</Text>
            </View>
          )}
          {privacy > 0n && (
            <View style={styles.feeBreakdownRow}>
              <Text style={styles.feeBreakdownLabel}>{t`Privacy fee`}</Text>
              <Text style={styles.feeBreakdownValue}>{formatFee(privacy)}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The height and paddings of a list row (ListItem): the label in the muted color, the value
  // in the text color.
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 64,
    paddingLeft: 16,
    paddingRight: 16,
  },
  feeRowLabel: {
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  feeRowValueWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feeRowValue: {
    fontSize: 16,
    color: COLORS.textColor,
  },
  feeBreakdown: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 8,
  },
  feeBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  feeBreakdownLabel: {
    fontSize: 13,
    color: COLORS.textColorShadow,
    // A small indent, so the breakdown reads as part of the fees, not as rows of their own.
    paddingLeft: 10,
  },
  feeBreakdownValue: {
    fontSize: 13,
    color: COLORS.textColorShadow,
  },
});
