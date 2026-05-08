/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import HathorHeader from '../components/HathorHeader';
import PrivacyModeCard from '../components/PrivacyModeCard';
import chevronRight from '../assets/icons/chevron-right.png';
import { COLORS } from '../styles/themes';
import { DEFAULT_PRIVACY_MODE } from '../constants';
import { privacyDefaultModeSet } from '../actions';
import { useNavigation } from '../hooks/navigation';

/**
 * Default-privacy-mode preferences screen, opened from Settings →
 * Privacy. The selected option is the user's default for new
 * transactions; the per-tx Privacy modal can still override it for a
 * single send. Toggling a row persists immediately via Redux +
 * AsyncStorage (handled in the privacySettings saga) — there is no
 * separate Save step.
 *
 * The actual three-row card is shared with the per-tx Transaction
 * Privacy modal via `PrivacyModeCard`. This screen only owns the
 * full-screen chrome — header, intro copy and the AUDIT row — so any
 * styling tweaks to the card propagate to both surfaces in a single
 * edit.
 */
const PrivacySettings = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const selectedMode = useSelector(
    (state) => state.privacyDefaultMode ?? DEFAULT_PRIVACY_MODE
  );

  const handleSelect = (mode) => {
    if (mode !== selectedMode) {
      dispatch(privacyDefaultModeSet(mode));
    }
  };

  // Gate the export-keys flow behind PinScreen. The pin is consumed
  // by ExportPrivacyKeys to decrypt the scan account xpriv via
  // wallet.storage.getScanXPrivKey(pin) — without the pin we have no
  // way to surface the key (it is encrypted at rest in access data).
  const handleExportKeys = () => {
    navigation.navigate('PinScreen', {
      cb: (pin) => {
        navigation.navigate('ExportPrivacyKeys', { pin });
      },
      canCancel: true,
      screenText: t`Enter your 6-digit PIN to export the audit keys`,
    });
  };

  return (
    <View style={styles.screen}>
      <HathorHeader
        title={t`PRIVACY SETTINGS`}
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
      >
        <Text style={styles.intro}>
          {t`You can change your default anytime, or switch per transaction when sending.`}
        </Text>

        <Text style={styles.sectionLabel}>{t`TRANSACTION DEFAULTS`}</Text>

        <PrivacyModeCard
          selectedMode={selectedMode}
          onSelect={handleSelect}
          variant='default'
        />

        {/* Audit / sharing section. The label uses the same visual
            weight as the section above so the screen reads as two
            separately-purposed cards rather than nested settings. */}
        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
          {t`AUDIT`}
        </Text>
        <TouchableOpacity style={styles.exportRow} onPress={handleExportKeys}>
          <Text style={styles.exportRowLabel}>{t`Export privacy keys`}</Text>
          <Image source={chevronRight} style={styles.exportRowChevron} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  intro: {
    fontSize: 14,
    color: COLORS.textColor,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textColorShadow,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionLabelSpaced: {
    marginTop: 32,
  },
  exportRow: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exportRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textColor,
  },
  exportRowChevron: {
    width: 18,
    height: 18,
    tintColor: COLORS.textColorShadow,
  },
});

export default PrivacySettings;
