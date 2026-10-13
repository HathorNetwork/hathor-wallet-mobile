/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import HathorHeader from '../components/HathorHeader';
import { ListMenu } from '../components/HathorList';
import PrivacyModeCard, { PRIVACY_MODE_CARD_VARIANT } from '../components/PrivacyModeCard';
import { COLORS } from '../styles/themes';
import { STORE } from '../store';
import { privacyDefaultModeKey } from '../constants';
import { privacyDefaultModeSet } from '../actions';
import { getNetworkSettings } from '../sagas/helpers';
import { isShieldedAvailable } from '../shielded/gating';
import { closeScreen } from '../utils/navigation';

/**
 * The privacy settings of the network the wallet runs on: the default privacy mode of its sends to
 * private addresses. A mode applies as soon as it is switched on, with no save step: it is saved
 * for the network, and every start of the wallet on the network loads it. The privacy sheet of a
 * send still overrides it for that send.
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
  const networkSettings = useSelector(getNetworkSettings);
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
    // The key of the network the wallet started on, the one startWallet reads.
    STORE.setItem(privacyDefaultModeKey(networkSettings), mode);
    dispatch(privacyDefaultModeSet(mode));
  };

  return (
    <View style={styles.screen}>
      <HathorHeader
        title={t`PRIVACY SETTINGS`}
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          {t`The default applies to your sends to private addresses. You can change it for each send.`}
        </Text>

        <Text style={styles.sectionLabel}>{t`DEFAULT FOR SENDS TO PRIVATE ADDRESSES`}</Text>
        <PrivacyModeCard
          selectedMode={selectedMode}
          onSelect={onSelect}
          variant={PRIVACY_MODE_CARD_VARIANT.DEFAULT}
        />

        {canExportKeys && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionSpaced]}>{t`AUDIT`}</Text>
            <View style={styles.menu}>
              <ListMenu
                title={t`Export privacy keys`}
                onPress={() => navigation.navigate('ExportPrivacyKeys')}
                isFirst
                isLast
              />
            </View>
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
    lineHeight: 20,
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
  menu: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderColor,
    overflow: 'hidden',
  },
});
