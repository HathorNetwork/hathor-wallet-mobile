/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS } from '../styles/themes';

/**
 * Custom toggle switch that replaces the native Switch component.
 *
 * The native UISwitch in React Native's New Architecture (Fabric) does not
 * fire onValueChange when tapped programmatically by automation tools
 * (Detox, Maestro, XCUITest). This Pressable-based toggle works reliably
 * with all test frameworks while maintaining identical UX.
 *
 * Props are compatible with the React Native Switch component.
 */
const ToggleSwitch = ({ value, onValueChange, trackColor, testID }) => (
  <Pressable
    testID={testID}
    accessibilityRole="switch"
    accessibilityState={{ checked: value }}
    onPress={() => onValueChange(!value)}
    hitSlop={8}
  >
    <View
      accessible={false}
      style={[
        styles.track,
        { backgroundColor: value ? (trackColor?.true || COLORS.primary) : '#E0E0E0' },
      ]}
    >
      <View
        accessible={false}
        style={[
          styles.thumb,
          { transform: [{ translateX: value ? 21 : 2 }] },
        ]}
      />
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  track: {
    width: 51,
    height: 31,
    borderRadius: 16,
    justifyContent: 'center',
  },
  thumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default ToggleSwitch;
