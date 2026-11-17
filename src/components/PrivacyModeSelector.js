/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getPrivacyModeDetail } from './PrivacyModeCard';
import { ChevronDownIcon } from './Icons/ChevronDown.icon';
import { COLORS } from '../styles/themes';

/**
 * The privacy mode of a send, as a card that opens the privacy sheet: the mode's icon, title and
 * description.
 *
 * @param {Object} props
 * @param {string} props.mode The send's mode, one of PRIVACY_MODE
 * @param {function(): void} props.onPress Opens the privacy sheet
 */
const PrivacyModeSelector = ({ mode, onPress }) => {
  const detail = getPrivacyModeDetail(mode);
  if (!detail) {
    return null;
  }
  const { Icon } = detail;

  const open = () => {
    // The amount input keeps the keyboard up, which would cover the sheet.
    Keyboard.dismiss();
    onPress();
  };

  return (
    <Pressable
      style={styles.card}
      onPress={open}
      accessibilityRole='button'
    >
      <View style={styles.cardLeft}>
        <Icon size={28} color={COLORS.textColor} />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{detail.title}</Text>
          <Text style={styles.cardSubtitle}>{detail.description}</Text>
        </View>
      </View>
      <ChevronDownIcon size={20} color={COLORS.textColorShadow} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 16,
    marginBottom: 16,
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textColor,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textColorShadow,
    marginTop: 4,
  },
});

export default PrivacyModeSelector;
