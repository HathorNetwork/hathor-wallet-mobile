/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { t } from 'ttag';

import BackdropModal from './BackdropModal';
import NewHathorButton from './NewHathorButton';
import TextFmt from './TextFmt';
import PrivacyModeCard from './PrivacyModeCard';
import { COLORS } from '../styles/themes';

/**
 * Bottom sheet that picks the privacy mode of one send, and says the default can be changed in
 * the advanced settings. The choice applies however the sheet closes (DONE, a tap outside it or a
 * swipe down): the switches look applied as soon as they flip, so a close must not drop them.
 *
 * @param {Object} props
 * @param {boolean} props.visible Whether the sheet shows
 * @param {string} props.selectedMode The send's mode, one of PRIVACY_MODE
 * @param {function(string): void} props.onConfirm Called with the chosen mode when the sheet closes
 */
const TransactionPrivacyModal = ({
  visible,
  selectedMode,
  onConfirm,
}) => {
  const [localMode, setLocalMode] = useState(selectedMode);

  // Start from the send's mode each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setLocalMode(selectedMode);
    }
  }, [visible, selectedMode]);

  const close = () => onConfirm(localMode);

  return (
    <BackdropModal
      visible={visible}
      onDismiss={close}
      animationType='slide'
      position='bottom'
      // A floating sheet, closer to the screen edges than the default padding.
      containerStyle={styles.modalWrapper}
      contentStyle={styles.modalContent}
    >
      <View style={styles.container}>
        <Text style={styles.title}>{t`Transaction privacy`}</Text>
        <TextFmt style={styles.subtitle}>
          {t`Choose what's hidden **only for this transaction**`}
        </TextFmt>

        <PrivacyModeCard
          selectedMode={localMode}
          onSelect={setLocalMode}
        />

        <Text style={styles.footerText}>
          {t`You can change your default on advanced settings`}
        </Text>

        <NewHathorButton
          title={t`DONE`}
          onPress={close}
        />
      </View>
    </BackdropModal>
  );
};

const styles = StyleSheet.create({
  modalWrapper: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  modalContent: {
    padding: 0,
    borderRadius: 16,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
    backgroundColor: COLORS.backgroundColor,
    // The sheet floats, so all four corners are round.
    borderRadius: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textColorShadow,
    marginBottom: 24,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textColorShadow,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
});

export default TransactionPrivacyModal;
