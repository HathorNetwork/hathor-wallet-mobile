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
  const isActive = (currOption) => (componentOption) => currOption === componentOption;
  const onTap = (option) => {
    setCurrOption(option);
    // Execute the callback assigned to the option
    options[option].onTap();
  };
  return (
    <View style={[styles.wrapper]}>
      <Option option='first' optionValue={options.first.value} isActive={isActive(currOption)} onTap={onTap} />
      <Option option='second' optionValue={options.second.value} isActive={isActive(currOption)} onTap={onTap} />
    </View>
  );
};

/**
 * @param {{
 *   option: 'first'|'second';
 *   optionValue: string;
 *   isActive: (componentOption: string) => boolean;
 *   onTap: (option: string) => void;
 * }}
 */
const Option = ({ option, optionValue, isActive, onTap }) => (
  <TouchableOpacity
    style={[styles.button, isActive(option) && styles.buttonFocus]}
    onPress={() => onTap(option)}
  >
    <Text style={[styles.text, isActive(option) && styles.textFocus]}>{optionValue}</Text>
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
