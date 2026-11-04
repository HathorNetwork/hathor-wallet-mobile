/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import { RadioGroup } from '../../components/Radio';
import { SimulatedTag } from '../../components/Multichain/SimulatedTag';
import { DevBackendSettings } from '../../components/Multichain/DevBackendSettings';
import { multichainMockReset, multichainMockScenarioSet } from '../../actions';
import { mockScenarioOptions } from '../../multichain/mock/scenarios';
import { getMultichainDevBackendFeatureToggle, selectDevBackend } from '../../multichain/gating';
import { COLORS } from '../../styles/themes';

/**
 * Settings → Hathor Next (simulated): how the simulated Hathor Next behaves, and a reset of its
 * ledger, while the client is the simulated one; and the Hathor Next backend for local testing,
 * which takes its place, only while its own flag is on.
 */
export default function MultichainMockSettings({ navigation }) {
  const dispatch = useDispatch();
  const scenario = useSelector((state) => state.multichain.mock.scenario);
  const devBackend = useSelector(selectDevBackend);
  const devBackendOn = useSelector(getMultichainDevBackendFeatureToggle);
  const options = mockScenarioOptions().map((option) => ({
    value: option.id,
    title: option.title,
    description: option.description,
  }));

  return (
    <View style={styles.wrapper}>
      <HathorHeader
        title={devBackend ? t`HATHOR NEXT (LOCAL BACKEND)` : t`HATHOR NEXT (SIMULATED)`}
        onBackPress={() => navigation.goBack()}
        withBorder
      />
      <ScrollView contentContainerStyle={styles.content}>
        {!devBackend && (
          <>
            <SimulatedTag />
            <Text style={styles.body}>
              {t`Nothing here reaches a network. Transfers to Hathor Next don't spend your Hathor Network balance, and arrive here only when sent to your own Hathor Next address.`}
            </Text>
            <Text style={styles.label}>{t`Scenario`}</Text>
            <RadioGroup
              value={scenario}
              onChange={(value) => dispatch(multichainMockScenarioSet(value))}
              options={options}
            />
            <Text style={styles.note}>
              {t`Changing the scenario starts the simulated ledger over. Slow sync, Connect fails and Goes offline take effect the next time Hathor Next loads: turn Connect to side chain off and on, or restart the app.`}
            </Text>
            <NewHathorButton
              secondary
              title={t`Reset simulated ledger`}
              onPress={() => dispatch(multichainMockReset())}
            />
          </>
        )}
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
  body: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textColor,
  },
  label: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textColorShadow,
  },
  note: {
    marginTop: 12,
    marginBottom: 24,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textColorShadow,
  },
});
