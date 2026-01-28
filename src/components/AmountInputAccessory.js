/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  InputAccessoryView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import { t } from 'ttag';
import { COLORS } from '../styles/themes';

/**
 * Quick action buttons for amount input (25%, 50%, Max, Done).
 * Uses InputAccessoryView on iOS for native keyboard integration.
 * On Android, renders as a regular component that should be positioned above the keyboard.
 *
 * @param {Object} props
 * @param {string} props.nativeID - Unique ID for InputAccessoryView (iOS only)
 * @param {bigint} props.availableBalance - The available balance to calculate percentages
 * @param {Function} props.onPercentagePress - Callback when percentage button is pressed
 * @param {Function} props.onDonePress - Callback when Done button is pressed
 * @param {boolean} [props.visible] - Whether to show the accessory (Android only)
 */
const AmountInputAccessory = ({
  nativeID,
  availableBalance,
  onPercentagePress,
  onDonePress,
  visible = true,
}) => {
  const handlePercentagePress = (percentage) => {
    if (availableBalance && availableBalance > 0n) {
      onPercentagePress(percentage);
    }
  };

  const handleDonePress = () => {
    Keyboard.dismiss();
    if (onDonePress) {
      onDonePress();
    }
  };

  const buttons = (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => handlePercentagePress(25)}
        disabled={!availableBalance || availableBalance === 0n}
      >
        <Text
          style={[
            styles.buttonText,
            (!availableBalance || availableBalance === 0n) && styles.buttonTextDisabled
          ]}
        >
          25%
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={() => handlePercentagePress(50)}
        disabled={!availableBalance || availableBalance === 0n}
      >
        <Text
          style={[
            styles.buttonText,
            (!availableBalance || availableBalance === 0n) && styles.buttonTextDisabled
          ]}
        >
          50%
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={() => handlePercentagePress(100)}
        disabled={!availableBalance || availableBalance === 0n}
      >
        <Text
          style={[
            styles.buttonText,
            (!availableBalance || availableBalance === 0n) && styles.buttonTextDisabled
          ]}
        >
          {t`Max`}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.doneButton]}
        onPress={handleDonePress}
      >
        <Text style={[styles.buttonText, styles.doneButtonText]}>{t`Done`}</Text>
      </TouchableOpacity>
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <InputAccessoryView nativeID={nativeID}>
        {buttons}
      </InputAccessoryView>
    );
  }

  // Android: render as a regular component (parent should position it)
  if (!visible) {
    return null;
  }

  return buttons;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.lowContrastDetail,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderColor,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderColor,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textColor,
  },
  buttonTextDisabled: {
    color: COLORS.midContrastDetail,
  },
  doneButtonText: {
    color: COLORS.white,
  },
});

export default AmountInputAccessory;
