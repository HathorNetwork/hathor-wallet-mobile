/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Spinner from '../Spinner';
import { syncingBody } from '../../multichain/content';
import { COLORS } from '../../styles/themes';

/**
 * While Hathor Next's first sync runs, the balances are a rising lower bound, never a total.
 *
 * @param {Object} props
 * @param {string} [props.text] What the notice says; the balance's caveat by default
 * @param {Object} [props.style]
 */
export const SyncingNotice = ({ text, style }) => (
  <View style={[styles.notice, style]} accessibilityRole='alert'>
    <Spinner size={14} animating />
    <Text style={styles.text}>{text ?? syncingBody()}</Text>
  </View>
);

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundColor,
    borderWidth: 1,
    borderColor: COLORS.borderColor,
  },
  text: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textColor,
  },
});
