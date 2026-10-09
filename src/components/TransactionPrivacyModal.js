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
import PrivacyModeCard from './PrivacyModeCard';
import { COLORS } from '../styles/themes';
import { PRIVACY_MODE } from '../constants';

/**
 * Bottom sheet that picks the privacy mode of one send. The choice applies when the user taps
 * Done; until then it stays in the sheet. For a send to a private address, the sheet points to
 * the default the send started in, which the privacy settings change.
 *
 * @param {Object} props
 * @param {boolean} props.visible Whether the sheet shows
 * @param {function(): void} props.onDismiss Called when the user dismisses it
 * @param {string} props.selectedMode The send's mode, one of PRIVACY_MODE
 * @param {string[]} props.options The modes the send can take
 * @param {function(string): void} props.onConfirm Called with the chosen mode on Done
 */
const TransactionPrivacyModal = ({
  visible,
  onDismiss,
  selectedMode,
  options,
  onConfirm,
}) => {
  const [localMode, setLocalMode] = useState(selectedMode);

  // Start from the send's mode each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setLocalMode(selectedMode);
    }
  }, [visible, selectedMode]);

  return (
    <BackdropModal
      visible={visible}
      onDismiss={onDismiss}
      animationType='slide'
      position='bottom'
      // A floating sheet, closer to the screen edges than the default padding.
      containerStyle={styles.modalWrapper}
      contentStyle={styles.modalContent}
    >
      <View style={styles.container}>
        <Text style={styles.title}>{t`Transaction privacy`}</Text>
        <Text style={styles.subtitle}>{t`Choose what this transaction hides.`}</Text>

        <PrivacyModeCard
          selectedMode={localMode}
          onSelect={setLocalMode}
          options={options}
        />

        {!options.includes(PRIVACY_MODE.PUBLIC) && (
          <>
            <Text style={styles.note}>
              {t`Payments to a private address are always private.`}
            </Text>
            <Text style={styles.hint}>
              {t`You can change the default in Settings, under Privacy.`}
            </Text>
          </>
        )}

        <NewHathorButton
          title={t`Done`}
          onPress={() => onConfirm(localMode)}
          style={styles.done}
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
  note: {
    fontSize: 12,
    color: COLORS.textColorShadow,
    textAlign: 'center',
    marginTop: 16,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textColorShadow,
    textAlign: 'center',
    marginTop: 8,
  },
  done: {
    marginTop: 20,
  },
});

export default TransactionPrivacyModal;
