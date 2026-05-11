/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import TokenListRow from './TokenListRow';
import { OpenInNewIcon } from './Icons/OpenInNew.icon';
import { COLORS } from '../styles/themes';
import { getShortHash } from '../utils';

/**
 * Renders a single token row inside a TokenListCard. Two variants:
 *
 * - **normal** (default): selectable row with a checkbox on the left, name +
 *   balance stacked in the middle, and a short uid + explorer link on the
 *   right. Tapping the row toggles selection.
 * - **readonly**: non-interactive review row with a symbol tag + name on the
 *   left and the balance on the right. Used in confirmation screens where
 *   the user is reviewing a frozen selection.
 */
const TokenItem = ({
  token,
  balance,
  isLast = false,
  readonly = false,
  isSelected = false,
  onToggle,
  onOpenExplorer,
}) => {
  if (readonly) {
    return (
      <TokenListRow isLast={isLast}>
        <View style={styles.readonlyLeft}>
          <View style={styles.symbolTag}>
            <Text style={styles.symbolText} numberOfLines={1}>{token.symbol}</Text>
          </View>
          <Text style={styles.nameInline} numberOfLines={1}>{token.name}</Text>
        </View>
        <Text style={styles.balanceInline} numberOfLines={1}>{balance}</Text>
      </TokenListRow>
    );
  }

  return (
    <TokenListRow isLast={isLast} onPress={onToggle} alignItems='flex-start'>
      <View style={styles.selectLeft}>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkmark}>&#10003;</Text>}
        </View>
        <View style={styles.selectInfo}>
          <Text style={styles.nameStacked} numberOfLines={1}>{token.name}</Text>
          <Text style={styles.balanceStacked} numberOfLines={1}>{balance}</Text>
        </View>
      </View>
      <View style={styles.selectRight}>
        <Text style={styles.uid} numberOfLines={1}>{getShortHash(token.uid, 5)}</Text>
        <TouchableOpacity onPress={onOpenExplorer} hitSlop={8}>
          <OpenInNewIcon size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </TokenListRow>
  );
};

const styles = StyleSheet.create({
  readonlyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  symbolTag: {
    backgroundColor: COLORS.tagSurface,
    borderRadius: 4,
    minWidth: 40,
    height: 23,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textColor,
    textAlign: 'center',
  },
  nameInline: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginLeft: 8,
    flexShrink: 1,
  },
  balanceInline: {
    fontSize: 14,
    color: COLORS.textColor,
    textAlign: 'right',
  },

  selectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: COLORS.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  selectInfo: {
    flexShrink: 1,
    gap: 2,
  },
  nameStacked: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textColor,
    lineHeight: 20,
  },
  balanceStacked: {
    fontSize: 14,
    color: COLORS.textColor,
    lineHeight: 20,
  },
  selectRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  uid: {
    fontSize: 12,
    color: COLORS.mutedText,
    lineHeight: 20,
  },
});

export default TokenItem;
