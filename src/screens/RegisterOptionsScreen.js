/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';
import { t } from 'ttag';
import { useSelector } from 'react-redux';
import { get } from 'lodash';
import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import { COLORS } from '../styles/themes';
import { NANO_CONTRACT_FEATURE_TOGGLE, REOWN_FEATURE_TOGGLE } from '../constants';

const RegisterOptionsScreen = ({ navigation }) => {
  const featureToggles = useSelector((state) => state.featureToggles);
  const serverInfo = useSelector((state) => state.serverInfo);
  const isReownEnabled = featureToggles[REOWN_FEATURE_TOGGLE] && get(serverInfo, 'nano_contracts_enabled', false);
  const isNanoContractEnabled = featureToggles[NANO_CONTRACT_FEATURE_TOGGLE] && get(serverInfo, 'nano_contracts_enabled', false);

  const getDescriptionText = () => {
    if (!isNanoContractEnabled && !isReownEnabled) {
      return t`You can register Tokens manually.`;
    }

    if (isNanoContractEnabled && !isReownEnabled) {
      return t`You can register Tokens and Nano Contracts manually.`;
    }

    if (!isNanoContractEnabled && isReownEnabled) {
      return t`You can register Tokens and use Reown manually.`;
    }

    return t`You can register Tokens, Nano Contracts or Reown manually.`;
  };

  const handleNanoContractNavigation = () => {
    if (!isNanoContractEnabled) {
      Alert.alert(
        t`Feature Not Available`,
        t`The nano contract feature is not enabled.`,
        [{ text: t`OK` }]
      );
      return;
    }
    navigation.navigate('NanoContractRegisterScreen');
  };

  const handleReownNavigation = () => {
    if (!isReownEnabled) {
      Alert.alert(
        t`Feature Not Available`,
        t`The reown feature is not enabled.`,
        [{ text: t`OK` }]
      );
      return;
    }
    navigation.navigate('ReownManual');
  };

  return (
    <View style={styles.container}>
      <HathorHeader
        title={t`Register`}
        onBackPress={() => navigation.goBack()}
      />
      <View style={styles.content}>
        <Text style={styles.description}>
          {getDescriptionText()}
        </Text>
        <View style={styles.buttonContainer}>
          {isNanoContractEnabled && (
            <NewHathorButton
              title={t`Register Nano Contract`}
              onPress={handleNanoContractNavigation}
              style={styles.button}
            />
          )}
          <NewHathorButton
            title={t`Register Token`}
            onPress={() => navigation.navigate('RegisterTokenManual')}
            style={styles.button}
          />
          {isReownEnabled && (
            <NewHathorButton
              title={t`Reown Connection`}
              onPress={handleReownNavigation}
              style={styles.button}
            />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  description: {
    fontSize: 16,
    color: COLORS.textColor,
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    backgroundColor: COLORS.black,
  },
});

export default RegisterOptionsScreen; 