/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import HathorHeader from '../components/HathorHeader';
import PrivacyModeCard, { PRIVACY_MODE_CARD_VARIANT } from '../components/PrivacyModeCard';
import chevronRight from '../assets/icons/chevron-right.png';
import { COLORS } from '../styles/themes';
import { PRIVACY_DEFAULT_MODE_KEY, STORE } from '../store';
import { privacyDefaultModeSet } from '../actions';
import { isShieldedAvailable } from '../shielded/gating';
import { closeScreen } from '../utils/navigation';

/**
 * The privacy settings: the default privacy mode of new sends. A mode applies as soon as it is
 * switched on, with no save step: it is saved for the device, on every network and across wallet
 * resets, and every start of the wallet loads it. The privacy sheet of a send still overrides it
 * for that send.
 *
 * Its audit section opens the export of the privacy keys, with no params: the export asks for the
 * PIN itself. A passkey wallet's record holds no scan key, so it gets no export.
 *
 * Settings opens it where the shielded UI is available. When it no longer is (the flag turns off,
 * or a reload or a network change starts), it closes with the screens above it, such as the export
 * and the export's PIN screen.
 *
 * @param {Object} props
 * @param {Object} props.navigation React Navigation's navigation object
 * @param {Object} props.route React Navigation's route of the screen
 */
export default function PrivacySettings({ navigation, route }) {
  const dispatch = useDispatch();
  const available = useSelector(isShieldedAvailable);
  const selectedMode = useSelector((state) => state.privacyDefaultMode);
  const canExportKeys = !STORE.isPasskeyWallet();

  useEffect(() => {
    if (!available) {
      closeScreen(navigation, route.key);
    }
  }, [available, navigation, route.key]);

  const onSelect = (mode) => {
    if (mode === selectedMode) {
      return;
    }
    STORE.setItem(PRIVACY_DEFAULT_MODE_KEY, mode);
    dispatch(privacyDefaultModeSet(mode));
  };

  return (
    <View style={styles.screen}>
      <HathorHeader
        title={t`PRIVACY SETTINGS`}
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps='handled'
      >
        <Text style={styles.intro}>
          {t`You can change your default anytime, or switch per transaction when sending.`}
        </Text>

        <Text style={styles.sectionLabel}>{t`TRANSACTION DEFAULTS`}</Text>
        <PrivacyModeCard
          selectedMode={selectedMode}
          onSelect={onSelect}
          variant={PRIVACY_MODE_CARD_VARIANT.DEFAULT}
        />

        {canExportKeys && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionSpaced]}>{t`AUDIT`}</Text>
            <TouchableOpacity
              style={styles.exportRow}
              onPress={() => navigation.navigate('ExportPrivacyKeys')}
            >
              <Text style={styles.exportRowLabel}>{t`Export privacy keys`}</Text>
              <Image source={chevronRight} style={styles.exportRowChevron} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  content: {
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
  sectionSpaced: {
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
