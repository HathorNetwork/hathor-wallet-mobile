/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { COLORS } from '../styles/themes';

/**
 * @param {{
 *   options: Map<'first'|'second', { value: string; onTap: Function; }>;
 *   defaultOption: 'first'|'second';
 * }}
 */
export const TwoOptionsToggle = ({ options, defaultOption }) => {
  const [currOption, setCurrOption] = useState(defaultOption);
  const isFirst = currOption === 'first';
  const isSecond = currOption === 'second';

  const onTapFirst = () => onTap('first');
  const onTapSecond = () => onTap('second');
  const onTap = (option) => {
    if (option === currOption) {
      // do nothing and halt.
      return;
    }
    setCurrOption(option);
    // Execute the callback assigned to the option
    options[option].onTap();
  };

  return (
    <View style={[styles.wrapper]}>
      <Option optionValue={options.first.value} isActive={isFirst} onTap={onTapFirst} />
      <Option optionValue={options.second.value} isActive={isSecond} onTap={onTapSecond} />
    </View>
  );
};

/**
 * @param {{
 *   optionValue: string;
 *   isActive: boolean;
 *   onTap: (option: string) => void;
 * }}
 */
const Option = ({ optionValue, isActive, onTap }) => (
  <TouchableOpacity
    style={[styles.button, isActive && styles.buttonFocus]}
    onPress={onTap}
  >
    <Text style={[styles.text, isActive && styles.textFocus]}>{optionValue}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  wrapper: {
    display: 'flex',
    flexDirection: 'row',
    width: '80%',
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: 'hsla(220, 10%, 94%, 1)',
  },
  button: {
    width: '50%',
    borderRadius: 24,
    paddingTop: 9,
    paddingBottom: 10,
    color: COLORS.textColor,
  },
  buttonFocus: {
    backgroundColor: COLORS.backgroundColor,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  textFocus: {
    fontWeight: 'bold',
  },
});
