/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../styles/themes';

/**
 * @param {object} props
 * @property {'default'|'outline'|'fill'} props.type
 * @property {StyleSheet} props.style
 * @property {ReactNode} props.children
 */
export const BaseIcon = ({ type = 'default', style, children }) => (
  <View style={[
    styles[type],
    style
  ]}
  >
    {children}
  </View>
);

const styles = StyleSheet.create({
  default: {},
  outline: {
    borderRadius: 8,
    borderWidth: 1.3,
    padding: 4,
  },
  fill: {
    borderRadius: 8,
    borderWidth: 1.3,
    borderColor: COLORS.primary,
    padding: 4,
    backgroundColor: COLORS.primary,
  },
});
