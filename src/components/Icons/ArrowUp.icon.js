/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import { View, Image, StyleSheet } from 'react-native';
import chevronUp from '../../assets/icons/chevron-up.png';
import { DEFAULT_ICON_SIZE } from './constants';

/**
 * @param {object} props
 * @property {number} props.size
 * @property {StyleSheet} props.style
 */
export const ArrowUpIcon = ({ size = DEFAULT_ICON_SIZE, style }) => (
  <View style={[styles.wrapper, style]}>
    <Image
      source={chevronUp}
      width={size}
      height={size}
    />
  </View>
);

const styles = StyleSheet.create({
  /* This wrapper adjusts the icon's size to 24x24, otherwise it would be 12x7. */
  wrapper: {
    paddingVertical: 8.5,
    paddingHorizontal: 6,
  },
});
