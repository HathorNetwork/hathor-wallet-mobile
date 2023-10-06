import React from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { t } from 'ttag';
import HathorHeader from '@components/HathorHeader';
import NewHathorButton from '@components/NewHathorButton';

const riskDisclaimerTitleText = t`Risk Disclaimer`.toUpperCase();
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
  centeredText: {
    fontSize: 16,
  },
  buttonContainer: {
    alignSelf: 'stretch',
  },
});

export const NetworkSettingsDislaimerNav = Symbol('NetworkSettingsDislaimer').toString();

export function NetworkSettingsDislaimerScreen({ navigation }) {
  return (
    <View style={style.container}>
      <HathorHeader
        title={riskDisclaimerTitleText}
        onBackPress={() => navigation.goBack()}
      />
      <View style={style.content}>
        <View>
          <Text style={style.centeredText}>
            {t`Do not change this unless you know what your are doing, and under no circustance change this settings based on someone else suggestion, as this can potentially make you susceptible to fraudulent schemes.`}
          </Text>
        </View>
        <View style={style.buttonContainer}>
          <NewHathorButton
            onPress={() => navigation.navigate('Settings') }
            title={t`I understand`} />
        </View>
      </View>
    </View>
  );
}
