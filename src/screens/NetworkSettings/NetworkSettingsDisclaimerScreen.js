/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { t } from 'ttag';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import { AlertUI, COLORS } from '../../styles/themes';
import { NetworkPreSettingsNav } from './NetworkPreSettingsScreen';

const riskDisclaimerTitleText = t`Risk Disclaimer`.toUpperCase();
const riskDisclaimerContentText = t`Do not change this unless you know what you are doing, and under no circumstances change these settings based on someone else suggestion, as this can potentially make you susceptible to fraudulent schemes.`;

const style = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 48,
  },
  warningContainer: {
    borderRadius: 8,
    backgroundColor: AlertUI.lightColor,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AlertUI.baseHslColor.addLightness(4).toString(),
    shadowColor: COLORS.textColor,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2, // Elevation for Android (optional)
  },
  warningMessage: {
    fontSize: 16,
    color: AlertUI.darkColor,
    padding: 16,
    paddingBottom: 48,
  },
  buttonContainer: {
    alignSelf: 'stretch',
  },
});

export const NetworkSettingsDisclaimerNav = Symbol('NetworkSettingsDisclaimer').toString();

export function NetworkSettingsDisclaimerScreen({ navigation }) {
  const handleNavigation = () => navigation.push(NetworkPreSettingsNav);

  return (
    <View style={style.container}>
      <HathorHeader
        title={riskDisclaimerTitleText}
        onBackPress={() => navigation.goBack()}
      />
      <View style={style.content}>
        <View style={style.warningContainer}>
          <Text style={style.warningMessage}>{riskDisclaimerContentText}</Text>
        </View>
        <View style={style.buttonContainer}>
          <NewHathorButton
            onPress={handleNavigation}
            title={t`I understand`}
          />
        </View>
      </View>
    </View>
  );
}
