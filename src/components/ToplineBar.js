/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { COLORS } from '../styles/themes';

const styles = StyleSheet.create({
  view: {
    backgroundColor: COLORS.errorBgColor,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
    height: 24,
  },
  text: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
});

export const ToplineBar = ({ style, text }) => {
  const viewStyle = {
    backgroundColor: style?.backgroundColor || styles.view.backgroundColor,
  };
  const textStyle = {
    color: style?.color || styles.text.color,
  };
  return (
    <View style={[styles.view, viewStyle]}>
      <Text style={[styles.text, textStyle]}>{ text }</Text>
    </View>
  );
}
