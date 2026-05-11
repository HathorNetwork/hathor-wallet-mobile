/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../styles/themes';

/**
 * Row inside a TokenListCard. Handles consistent padding and the hairline
 * bottom border (suppressed on the last row to avoid a divider stacking on
 * top of the card's bottom padding).
 *
 * Becomes a TouchableOpacity when `onPress` is provided, otherwise a plain
 * View — keeps non-interactive lists from looking pressable.
 */
const TokenListRow = ({
  children,
  isLast = false,
  onPress,
  alignItems = 'center',
}) => {
  const containerStyle = [
    styles.row,
    { alignItems },
    !isLast && styles.rowBorder,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderColor,
  },
});

export default TokenListRow;
