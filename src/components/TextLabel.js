/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
} from 'react-native';

export const TextLabel = ({ pb8, bold, children }) => (
  <Text style={[
    styles.textLabel,
    pb8 && styles.pb8,
    bold && styles.bold,
  ]}
  >{children}</Text>
);

const styles = StyleSheet.create({
  textLabel: {
    fontSize: 12,
    lineHeight: 20,
    color: 'hsla(0, 0%, 38%, 1)',
  },
  pb8: {
    paddingBottom: 8,
  },
  bold: {
    fontWeight: 'bold',
  },
});
