/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { t } from 'ttag';
import { COLORS } from '../styles/themes';

/**
 * Quick-action buttons for an amount input (25%, 50%, Max, Done).
 * Renders as a regular component; the parent is responsible for
 * positioning it above the keyboard (e.g. via an absolutely-positioned
 * overlay tied to keyboard events).
 *
 * Previously this component used iOS's `<InputAccessoryView>` to attach
 * itself to the keyboard window. That caused iOS to keep the accessory
 * height associated with the keyboard frame across screen unmounts —
 * the next screen with `<KeyboardAvoidingView>` then over-padded by the
 * accessory's height (~92 px). Rendering as a plain view instead, and
 * letting the parent place it, removes that leak entirely.
 *
 * @param {Object} props
 * @param {bigint} props.availableBalance - Used to compute percentages
 * @param {Function} props.onPercentagePress - Called with 25 | 50 | 100
 * @param {Function} [props.onDonePress] - Optional extra Done handler
 * @param {boolean} [props.visible=true] - Skip rendering when false
 */
const AmountInputAccessory = ({
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
