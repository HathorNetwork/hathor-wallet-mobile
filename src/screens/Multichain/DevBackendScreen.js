/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import HathorHeader from '../../components/HathorHeader';
import { DevBackendSettings } from '../../components/Multichain/DevBackendSettings';
import { getMultichainDevBackendFeatureToggle } from '../../multichain/gating';
import { COLORS } from '../../styles/themes';

/**
 * Settings → Hathor Next (local backend): the Hathor Next backend for local testing, only while
 * its own flag is on.
 */
export default function DevBackendScreen({ navigation }) {
  const devBackendOn = useSelector(getMultichainDevBackendFeatureToggle);

  return (
    <View style={styles.wrapper}>
      <HathorHeader
        title={t`HATHOR NEXT (LOCAL BACKEND)`}
        onBackPress={() => navigation.goBack()}
        withBorder
      />
      {/* The backend's field is last: the keyboard would cover it without the inset. Android pans
          the window to the field instead (adjustPan). */}
      <ScrollView
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps='handled'
      >
        {devBackendOn && <DevBackendSettings />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.lowContrastDetail,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
});
