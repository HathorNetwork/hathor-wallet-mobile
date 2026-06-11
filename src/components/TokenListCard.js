/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../styles/themes';

/**
 * Card wrapper for a list of tokens — white background, rounded, shadowed,
 * with vertical padding so the first/last rows breathe.
 *
 * The outer container intentionally accepts a `style` override so callers
 * can decide its flex behavior (`flex: 1` to fill remaining space, or
 * `flexShrink: 1` to size to content).
 */
const TokenListCard = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 16,
    shadowColor: COLORS.textColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    paddingVertical: 16,
  },
});

export default TokenListCard;
