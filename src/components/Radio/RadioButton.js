/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../styles/themes';

/**
 * A single radio circle: outer ring plus an inner dot when selected.
 *
 * @param {Object} props
 * @param {boolean} props.selected - If true, the radio is selected.
 * @param {boolean} [props.disabled] - If true, the radio is disabled.
 */
export default function RadioButton({ selected, disabled = false }) {
  const selectedColor = disabled ? COLORS.borderColorDark : COLORS.primary;
  const borderColor = selected ? selectedColor : COLORS.borderColorDark;
  return (
    <View style={[styles.outer, { borderColor }]}>
      {selected && <View style={[styles.inner, { backgroundColor: selectedColor }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
