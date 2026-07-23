/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../styles/themes';

/**
 * Full-width primary save button used by the preference screens. Renders only
 * the button; the screen supplies its own outer container/margins.
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {Function} props.onPress
 * @param {boolean} props.disabled
 */
export default function PreferenceSaveButton({ title, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled ? styles.buttonDisabled : styles.buttonActive]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.text, disabled ? styles.textDisabled : styles.textActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: COLORS.borderColorMid,
  },
  buttonActive: {
    backgroundColor: COLORS.black,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  textDisabled: {
    color: COLORS.darkContrastDetail,
  },
  textActive: {
    color: COLORS.white,
  },
});
