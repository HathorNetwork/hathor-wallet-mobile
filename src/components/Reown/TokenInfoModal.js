/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Clipboard } from 'react-native';
import { t } from 'ttag';
import { COLORS } from '../../styles/themes';
import NewHathorButton from '../NewHathorButton';

const styles = StyleSheet.create({
  tokenInfoModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  tokenInfoModalContent: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tokenInfoModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginBottom: 16,
    textAlign: 'center',
  },
  tokenInfoRow: {
    marginBottom: 12,
  },
  tokenInfoLabel: {
    fontSize: 12,
    color: COLORS.textColorShadow,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  tokenInfoValue: {
    fontSize: 14,
    color: COLORS.textColor,
    fontFamily: 'monospace',
  },
  tokenInfoButtons: {
    marginTop: 16,
    gap: 8,
  },
  copyButton: {
    color: 'hsla(263, 100%, 64%, 1)',
    marginTop: 4,
  },
});

/**
 * Modal component to display information about an unregistered token
 *
 * @param {Object} props
 * @param {boolean} props.visible - Whether the modal is visible
 * @param {Object} props.tokenInfo - Token information object with name, symbol, and uid
 * @param {Function} props.onClose - Callback when modal is closed
 */
export const TokenInfoModal = ({ visible, tokenInfo, onClose }) => {
  if (!visible || !tokenInfo) {
    return null;
  }

  return (
    <View style={styles.tokenInfoModalOverlay}>
      <TouchableOpacity
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={onClose}
        activeOpacity={1}
      />
      <View style={styles.tokenInfoModalContent}>
        <Text style={styles.tokenInfoModalTitle}>{t`Unregistered Token`}</Text>

        <View style={styles.tokenInfoRow}>
          <Text style={styles.tokenInfoLabel}>{t`Name`}</Text>
          <Text style={styles.tokenInfoValue}>{tokenInfo.name}</Text>
        </View>

        <View style={styles.tokenInfoRow}>
          <Text style={styles.tokenInfoLabel}>{t`Symbol`}</Text>
          <Text style={styles.tokenInfoValue}>{tokenInfo.symbol}</Text>
        </View>

        <View style={styles.tokenInfoRow}>
          <Text style={styles.tokenInfoLabel}>{t`Token UID`}</Text>
          <TouchableOpacity onPress={() => Clipboard.setString(tokenInfo.uid)}>
            <Text style={[styles.tokenInfoValue, { color: COLORS.primary }]}>
              {tokenInfo.uid}
            </Text>
            <Text style={styles.copyButton}>{t`Tap to copy`}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tokenInfoButtons}>
          <NewHathorButton
            title={t`Close`}
            onPress={onClose}
          />
        </View>
      </View>
    </View>
  );
};

export default TokenInfoModal;
