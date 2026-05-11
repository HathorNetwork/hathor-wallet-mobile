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
 * Bottom-sheet modal for picking a per-tx privacy override. The
 * three-row card is shared with the Privacy Settings screen via
 * `PrivacyModeCard`; this component owns the modal chrome (title,
 * subtitle, footer hint, DONE button) and the in-flight `localMode`
 * state so the user can change selection without committing until
 * they tap DONE. The default for new sends is configured under
 * Settings → Privacy and lives in `state.privacyDefaultMode`; this
 * modal only overrides for a single transaction.
 *
 * @param {object} props
 * @param {boolean} props.visible — Whether the modal is visible
 * @param {function} props.onDismiss — Called when modal should dismiss
 * @param {string} props.selectedMode — Currently selected privacy mode key
 * @param {function} props.onConfirm — Called with selected mode key on DONE press
 */
const TransactionPrivacyModal = ({ visible, onDismiss, selectedMode, onConfirm }) => {
  const [localMode, setLocalMode] = useState(selectedMode);

  // Sync local state when the modal opens with a (possibly new)
  // selectedMode from the parent.
  useEffect(() => {
    if (visible) {
      setLocalMode(selectedMode);
    }
  }, [visible, selectedMode]);

  const handleDone = () => {
    onConfirm(localMode);
  };

  return (
    <BackdropModal
      visible={visible}
      onDismiss={onDismiss}
      animationType='slide'
      position='bottom'
      // Override the BackdropModal default 20px side/bottom padding
      // so the sheet sits closer to the screen edges than other
      // modals (which use the default), without going fully flush.
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
          variant='per-tx'
        />

        <Text style={styles.footerText}>
          {t`You can change your default on advanced settings`}
        </Text>

        <NewHathorButton
          title={t`DONE`}
          onPress={handleDone}
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
    // Sheet is floating (8px margin) instead of flush with the
    // screen edges, so round all four corners.
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
