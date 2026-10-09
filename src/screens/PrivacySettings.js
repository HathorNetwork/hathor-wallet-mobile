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
import PrivacyModeCard, { PRIVACY_MODE_CARD_VARIANT } from '../components/PrivacyModeCard';
import { COLORS } from '../styles/themes';
import { STORE } from '../store';
import { privacyDefaultModeKey } from '../constants';
import { privacyDefaultModeSet } from '../actions';
import { getNetworkSettings } from '../sagas/helpers';
import { isShieldedAvailable } from '../shielded/gating';
import { PRIVACY_DEFAULT_MODE_OPTIONS } from '../utils/privacy';

/**
 * The privacy settings of the network the wallet runs on: the default privacy mode of its sends to
 * private addresses. A mode applies as soon as it is switched on, with no save step: it is saved
 * for the network, and every start of the wallet on the network loads it. The privacy sheet of a
 * send still overrides it for that send.
 *
 * Settings opens it where the shielded UI is available. It goes back when it no longer is: the
 * flag turns off, or a reload or a network change starts.
 *
 * @param {Object} props
 * @param {Object} props.navigation React Navigation's navigation object
 */
export default function PrivacySettings({ navigation }) {
  const dispatch = useDispatch();
  const available = useSelector(isShieldedAvailable);
  const networkSettings = useSelector(getNetworkSettings);
  const selectedMode = useSelector((state) => state.privacyDefaultMode);

  useEffect(() => {
    if (!available) {
      navigation.goBack();
    }
  }, [available, navigation]);

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
          options={PRIVACY_DEFAULT_MODE_OPTIONS}
          variant={PRIVACY_MODE_CARD_VARIANT.DEFAULT}
        />
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
});
