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
import { msgid, ngettext, t } from 'ttag';

import { ChevronDownIcon } from '../Icons/ChevronDown.icon';
import { ChevronUpIcon } from '../Icons/ChevronUp.icon';
import { InfoCircleIcon } from '../Icons/InfoCircle';
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
 * @param {Object} [props.labelStyle] The style of the total's label
 * @param {Object} [props.valueStyle] The style of the total's value
 * @param {Object} [props.breakdownStyle] The style of the expanded network and privacy fees
 * @param {number} [props.privateOutputs] How many shielded outputs pay the privacy fee, said
 *   under it when given
 * @param {function(): void} [props.onInfoPress] When given, an info icon beside the total's label
 *   calls it
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
  labelStyle,
  valueStyle,
  breakdownStyle,
  privateOutputs,
  onInfoPress,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formatFee = (amount) => (
    `${renderValue(amount, false, decimalPlaces, amountFormat)} ${symbol}`
  );

  const label = <Text style={[styles.feeRowLabel, labelStyle]}>{t`Fees`}</Text>;
  const privacyLabel = <Text style={styles.feeBreakdownLabel}>{t`Privacy fee`}</Text>;
  const count = privateOutputs;

  return (
    <View style={style}>
      <TouchableOpacity
        style={[styles.feeRow, rowStyle]}
        onPress={() => setIsExpanded((expanded) => !expanded)}
        activeOpacity={0.6}
      >
        {onInfoPress ? (
          <View style={styles.feeRowLabelWrapper}>
            {label}
            <TouchableOpacity
              onPress={onInfoPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole='button'
            >
              <InfoCircleIcon size={16} />
            </TouchableOpacity>
          </View>
        ) : label}
        <View style={styles.feeRowValueWrapper}>
          <Text style={[styles.feeRowValue, valueStyle]}>{formatFee(total)}</Text>
          {isExpanded
            ? <ChevronUpIcon size={16} color={COLORS.textColor} />
            : <ChevronDownIcon size={16} color={COLORS.textColor} />}
        </View>
      </TouchableOpacity>
      {isExpanded && (
        <View style={[styles.feeBreakdown, breakdownStyle]}>
          {network > 0n && (
            <View style={styles.feeBreakdownRow}>
              <Text style={styles.feeBreakdownLabel}>{t`Network fee`}</Text>
              <Text style={styles.feeBreakdownValue}>{formatFee(network)}</Text>
            </View>
          )}
          {privacy > 0n && (
            <View style={styles.feeBreakdownRow}>
              {count > 0 ? (
                <View>
                  {privacyLabel}
                  <Text style={styles.feeBreakdownDetail}>
                    {ngettext(msgid`${count} private output`, `${count} private outputs`, count)}
                  </Text>
                </View>
              ) : privacyLabel}
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
  feeRowLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  feeBreakdownDetail: {
    fontSize: 12,
    color: COLORS.textColorShadow,
    paddingLeft: 10,
  },
});
