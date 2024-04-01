/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import { View, Image, StyleSheet } from 'react-native';
import chevronDown from '../../assets/icons/chevron-down.png';

/**
 * @typedef {Object} Properties prop
 * @property {StyleSheet} prop.style
 *
 * @param {Properties} properties
 */
export const ArrowDownIcon = ({ style }) => (
  <View style={[styles.wrapper, style]}>
    <Image source={chevronDown} width={24} height={24} />
  </View>
);

const styles = StyleSheet.create({
  /* This wrapper adjusts the icon's size to 24x24, otherwise it would be 12x7. */
  wrapper: {
    paddingVertical: 8.5,
    paddingHorizontal: 6,
  },
});
