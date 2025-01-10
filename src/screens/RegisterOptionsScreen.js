/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from 'ttag';
import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import { COLORS } from '../styles/themes';

const RegisterOptionsScreen = ({ navigation }) => (
  <View style={styles.container}>
    <HathorHeader
      title={t`Register`}
      onBackPress={() => navigation.goBack()}
    />
    <View style={styles.content}>
      <Text style={styles.description}>
        {t`You can choose to register manually Tokens, Nano Contracts or Reown.`}
      </Text>
      <View style={styles.buttonContainer}>
        <NewHathorButton
          title={t`Register Nano Contract`}
          onPress={() => navigation.navigate('NanoContractRegisterScreen')}
          style={styles.button}
        />
        <NewHathorButton
          title={t`Register Token`}
          onPress={() => navigation.navigate('RegisterTokenManual')}
          style={styles.button}
        />
        <NewHathorButton
          title={t`Reown Connection`}
          onPress={() => navigation.navigate('ReownManual')}
          style={styles.button}
        />
      </View>
    </View>
  </View>
);

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