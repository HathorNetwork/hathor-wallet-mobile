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
import { commonStyles } from './Reown/theme';

/**
 * @param {Object} props
 * @param {boolean} props.title It sets font weight to bold and a larger font size
 * @param {boolean} props.label It sets font weight to bold and a bottom margin
 * @param {boolean} props.bold It sets font weight to bold
 * @param {boolean} props.oneline It sets numberOfLines to 1
 * @param {boolean} props.shrink It sets flexShrink to 1
 * @param {boolean} props.pb4 It sets padding bottom to 4
 * @param {string} props.color It sets text color
 */
export const TextValue = ({ title, label, bold, oneline, shrink, pb4, color, children }) => (
  <Text style={[
    styles.textValue,
    title && styles.title,
    label && styles.label,
    oneline && styles.oneline,
    shrink && styles.shrink,
    bold && styles.bold,
    pb4 && styles.pb4,
    color && { color },
  ]}
  >{children}</Text>
);

const styles = StyleSheet.create({
  textValue: {
    fontSize: 14,
    lineHeight: 20,
    color: 'black',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  label: [
    commonStyles.bold,
    commonStyles.mb4,
  ],
  pb4: {
    paddingBottom: 4,
  },
  bold: {
    fontWeight: 'bold',
  },
  oneline: {
    numberOfLines: 1,
  },
  shrink: {
    flexShrink: 1,
  },
});
