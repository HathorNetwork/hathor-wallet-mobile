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
  walletServiceLoadFailedAck,
} from '../actions';
import ActionModal from '../components/ActionModal';
import SimpleButton from '../components/SimpleButton';
import Spinner from '../components/Spinner';
import TextFmt from '../components/TextFmt';
import { COLORS } from '../styles/themes';

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
  const shouldDisplayWalletServiceLoadFailedModal = useSelector(
    (state) => state.showWalletServiceLoadFailedModal,
  );

  useEffect(() => {
    dispatch(resetLoadedData());
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
        title='Try again'
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

  const dispatchRenderFailedAck = () => dispatch(walletServiceLoadFailedAck());

  const renderFailedWalletServiceModal = () => (
    <ActionModal
      title={t`Wallet Service failed`}
      text={t`Loading wallet in the wallet service facade failed, falling back to the fullnode facade.`}
      button={t`Ok`}
      onAction={dispatchRenderFailedAck}
      onDismiss={dispatchRenderFailedAck}
    />
  );

  return (
    <>
      {shouldDisplayWalletServiceLoadFailedModal && renderFailedWalletServiceModal()}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {loadHistoryStatus.error ? renderError() : renderLoading()}
      </View>
    </>
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
