/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import {
  StyleSheet, Text, View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import {
  onWalletReload,
  resetLoadedData,
} from '../actions';
import SimpleButton from '../components/SimpleButton';
import Spinner from '../components/Spinner';
import TextFmt from '../components/TextFmt';
import { COLORS } from '../styles/themes';
import { logger } from '../logger';
import Performance from '../utils/performance';

const log = logger('loadhistory');

/**
 * Screen shown while loading wallet history
 */
export default function LoadHistoryScreen() {
  const dispatch = useDispatch();
  /**
   * loadHistoryStatus {Object} progress on loading tx history {
   *   active {boolean} indicates we're loading the tx history
   *   error {boolean} error loading history
   * }
   */
  const loadHistoryStatus = useSelector((state) => state.loadHistoryStatus);
  const loadedData = useSelector((state) => state.loadedData);
  const wallet = useSelector((state) => state.wallet);
  const initWallet = useSelector((state) => state.initWallet);

  useEffect(() => {
    dispatch(resetLoadedData());

    if (initWallet && initWallet.words && initWallet.pin) {
      // We're now starting this measurement in the wallet saga for reliability
      // Performance.start('WALLET_TOTAL_STARTUP_TO_DASHBOARD');
      log.log('🔍 PROFILING: Starting wallet load from LoadHistoryScreen');

      if (!wallet) {
        // We've already set the initWallet redux store with the words
        // we need to start the wallet
        dispatch({
          type: 'START_WALLET_REQUESTED',
          payload: {
            words: initWallet.words,
            pin: initWallet.pin,
          },
        });
      }
    }
  }, []);

  const renderError = () => (
    <View style={{ alignItems: 'center' }}>
      <Text style={{
        fontSize: 18, lineHeight: 22, width: 200, textAlign: 'center'
      }}
      >
        There&apos;s been an error connecting to the server
      </Text>
      <SimpleButton
        containerStyle={{ marginTop: 12 }}
        textStyle={{ fontSize: 18 }}
        onPress={() => dispatch(onWalletReload())}
        title={t`Try again`}
      />
    </View>
  );

  const renderLoading = () => (
    <View style={{ alignItems: 'center' }}>
      <Spinner size={48} animating />
      <Text style={[styles.text, { marginTop: 32, color: COLORS.textColorShadow }]}>
        {t`Loading your transactions`}
      </Text>
      <TextFmt style={[styles.text, { marginTop: 24 }]}>
        {t`**${loadedData.transactions} transactions** found`}
      </TextFmt>
      <TextFmt style={styles.text}>
        {t`**${loadedData.addresses} addresses** found`}
      </TextFmt>
    </View>
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {loadHistoryStatus.error ? renderError() : renderLoading()}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 16,
  },
});
