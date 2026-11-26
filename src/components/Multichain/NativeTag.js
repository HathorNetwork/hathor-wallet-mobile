/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from 'ttag';
import { COLORS } from '../../styles/themes';

/**
 * Marks a native token where Hathor Next's tokens are listed: HTR, and the side chain's own
 * token. The app knows them by their pinned ids. Anyone can create a token under any name and
 * symbol, HTR's included, but no other token gets this tag: it carries its id instead.
 *
 * @param {Object} props
 * @param {Object} [props.style]
 */
export const NativeTag = ({ style }) => (
  <View style={[styles.tag, style]} accessibilityRole='text'>
    <Text style={styles.text}>{t`Native`}</Text>
  </View>
);

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 7,
    backgroundColor: COLORS.primaryOpacity10,
  },
  text: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});
