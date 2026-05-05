/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import PrivacyModeCard from '../components/PrivacyModeCard';
import { COLORS } from '../styles/themes';
import { DEFAULT_PRIVACY_MODE } from '../constants';
import { privacyDefaultModeSet } from '../actions';
import { useNavigation } from '../hooks/navigation';

/**
 * Default-privacy-mode preferences screen, opened from Settings →
 * Privacy. The selected option is the user's default for new
 * transactions; the per-tx Privacy modal can still override it for a
 * single send. "Save Preferences" persists the choice via Redux +
 * AsyncStorage (handled in the privacySettings saga).
 *
 * The actual three-row card is shared with the per-tx Transaction
 * Privacy modal via `PrivacyModeCard`. This screen only owns the
 * full-screen chrome — header, intro copy, section label and the
 * Save button — so any styling tweaks to the card propagate to both
 * surfaces in a single edit.
 */
const PrivacySettings = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const persistedMode = useSelector(
    (state) => state.privacyDefaultMode ?? DEFAULT_PRIVACY_MODE
  );

  // Local draft so the user can change selection without committing
  // until they tap Save. Initialised from the persisted value.
  const [selectedMode, setSelectedMode] = useState(persistedMode);

  const handleSave = () => {
    if (selectedMode !== persistedMode) {
      dispatch(privacyDefaultModeSet(selectedMode));
    }
    navigation.goBack();
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
          onSelect={setSelectedMode}
          variant='default'
        />
      </ScrollView>

      <View style={styles.footer}>
        <NewHathorButton title={t`SAVE PREFERENCES`} onPress={handleSave} />
      </View>
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
  footer: {
    padding: 16,
    paddingBottom: 24,
  },
});

export default PrivacySettings;
