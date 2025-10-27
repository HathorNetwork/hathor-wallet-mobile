/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { t } from 'ttag';
import { useDispatch } from 'react-redux';
import {
  networkSettingsPersistStore,
  networkSettingsUpdateReady,
  onStartWalletLock,
  resetOnLockScreen,
  lockScreen
} from '../actions';
import SimpleButton from '../components/SimpleButton';
import { PRE_SETTINGS_MAINNET } from '../constants';

const errorText = t`There's been an error connecting to the server.`;
const tryAgainText = t`Try again`;
const resetWalletText = t`Reset wallet`;
const onConnectToMainnetText = t`Connect to mainnet`;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    justifyContent: 'center'
  },
  errorText: {
    fontSize: 18,
    lineHeight: 22,
    width: 200,
    textAlign: 'center'
  },
  tryAgainText: {
    fontSize: 18,
  },
  tryAgainButton: {
    alignItems: 'center',
    marginTop: 12
  },
  resetContainer: {
    alignItems: 'center',
    paddingBottom: 48,
  },
  resetText: {
    fontSize: 18
  }
});

export default () => {
  const dispatch = useDispatch();
  const onReload = useCallback(() => {
    // This will set the walletState to LOADING
    dispatch(onStartWalletLock());
    // Display the PinScreen
    dispatch(lockScreen());
  }, [dispatch]);
  const onReset = useCallback(() => {
    // This will set resetOnLockScreen to true
    dispatch(resetOnLockScreen());
    // This will set the walletState to LOADING
    dispatch(onStartWalletLock());
    // This redirect the user to the lockScreen.
    // However, it will display the resetScreen,
    // which is an auxiliar view on top of it.
    // This behavior happens because resetOnLockScreen
    // was set to true.
    dispatch(lockScreen());
  }, [dispatch]);
  const onConnectToMainnet = useCallback(() => {
    // Set the network settings as mainnet in the store
    dispatch(networkSettingsPersistStore(PRE_SETTINGS_MAINNET));
    // This will set the walletState to LOADING
    dispatch(onStartWalletLock());
    // Display the PinScreen
    dispatch(lockScreen());
    // No need to show a success feedback modal in this case
    dispatch(networkSettingsUpdateReady());
  }, [dispatch]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.errorText}>{errorText}</Text>
        <SimpleButton
          containerStyle={styles.tryAgainButton}
          textStyle={styles.tryAgainText}
          onPress={onReload}
          title={tryAgainText}
        />
        <SimpleButton
          containerStyle={styles.tryAgainButton}
          textStyle={styles.tryAgainText}
          onPress={onConnectToMainnet}
          title={onConnectToMainnetText}
        />
      </View>
      <View style={styles.resetContainer}>
        <SimpleButton
          textStyle={styles.resetText}
          onPress={onReset}
          title={resetWalletText}
        />
      </View>
    </View>
  );
};
