/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../styles/themes';
import RadioOption from './RadioOption';

/**
 * A bordered card grouping radio options, separated by dividers. Controlled:
 * the caller owns the selected `value` and receives it back via `onChange`.
 *
 * @param {Object} props
 * @param {string|number} props.value - The currently selected option value.
 * @param {Function} props.onChange - Called with an option's `value` on press.
 * @param {Array<{
 *   value: string|number, title: string, description?: string, hint?: string,
 *   badge?: string, disabled?: boolean
 * }>} props.options
 */
export default function RadioGroup({ value, onChange, options }) {
  return (
    <View accessibilityRole='radiogroup' style={styles.card}>
      {options.map((option, index) => (
        <React.Fragment key={String(option.value)}>
          {index > 0 && <View style={styles.divider} />}
          <RadioOption
            selected={value === option.value}
            onPress={() => {
              // Deliberately redundant with the touchable's `disabled`: keeps
              // the guard in JS rather than RN's touch-responder layer.
              if (!option.disabled) onChange(option.value);
            }}
            disabled={option.disabled}
            title={option.title}
            badge={option.badge}
            description={option.description}
            hint={option.hint}
          />
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: COLORS.borderColor,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderColor,
    marginVertical: 24,
  },
});
