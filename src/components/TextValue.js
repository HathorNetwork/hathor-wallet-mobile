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

export const TextValue = ({ bold, pb4, children }) => (
  <Text style={[
    styles.textValue,
    bold && styles.bold,
    pb4 && styles.pb4,
  ]}
  >{children}</Text>
);

const styles = StyleSheet.create({
  textValue: {
    fontSize: 14,
    lineHeight: 20,
    color: 'black',
  },
  pb4: {
    paddingBottom: 4,
  },
  bold: {
    fontWeight: 'bold',
  },
});
