/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { COLORS } from '../styles/themes';

const InputLabel = (props) => (
  <Text
    style={[styles.text, props.style]}
  >
    {props.children}
  </Text>
);

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    lineHeight: 14,
    color: COLORS.textColorShadow,
  },
});

export default InputLabel;
