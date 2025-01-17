/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { View, Alert, SafeAreaView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { get } from 'lodash';

import QRCodeReader from '../components/QRCodeReader';
import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';
import OfflineBar from '../components/OfflineBar';
import { reownUriInputted } from '../actions';
import { COLORS } from '../styles/themes';
import { NANO_CONTRACT_FEATURE_TOGGLE, REOWN_FEATURE_TOGGLE } from '../constants';

const UnifiedQRScanner = ({ navigation }) => {
  const dispatch = useDispatch();
  const [isProcessing, setIsProcessing] = useState(false);
  const featureToggles = useSelector((state) => state.featureToggles);
  const serverInfo = useSelector((state) => state.serverInfo);
  const isReownEnabled = featureToggles[REOWN_FEATURE_TOGGLE] && get(serverInfo, 'nano_contracts_enabled', false);
  const isNanoContractEnabled = featureToggles[NANO_CONTRACT_FEATURE_TOGGLE] && get(serverInfo, 'nano_contracts_enabled', false);

  const showAlert = (title, message) => {
    if (isProcessing) return;
    setIsProcessing(true);
    Alert.alert(
      title,
      message,
      [{ text: t`OK`, onPress: () => setIsProcessing(false) }]
    );
  };

  const onSuccess = (e) => {
    if (isProcessing) return;
    const qrData = e.data;

    // Regex patterns for different types
    const reownPattern = /^wc:[a-f0-9]+@\d+\?.*$/;
    const tokenPattern = /^\[.*:.*:.*:.*\]$/;
    const nanoContractPattern = /^[a-f0-9]{64}$/;

    // Check if it's a reown URI
    if (reownPattern.test(qrData)) {
      if (!isReownEnabled) {
        showAlert(t`Feature Not Available`, t`The reown feature is not enabled.`);
        return;
      }
      dispatch(reownUriInputted(qrData));
      navigation.replace('ReownList');
      return;
    }

    // Check if it's a token registration QR code
    if (tokenPattern.test(qrData)) {
      navigation.replace('RegisterTokenManual', { configurationString: qrData });
      return;
    }

    // Check if it's a nano contract ID
    if (nanoContractPattern.test(qrData)) {
      if (!isNanoContractEnabled) {
        showAlert(t`Feature Not Available`, t`The nano contract feature is not enabled.`);
        return;
      }
      navigation.replace('NanoContractRegisterScreen', { ncId: qrData });
      return;
    }

    // If none of the patterns match, show an error or handle accordingly
    showAlert(t`Invalid QR Code`, t`The scanned QR code is not in a recognized format.`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.lowContrastDetail }}>
      <HathorHeader
        title={t`Scan QR Code`}
        wrapperStyle={{ borderBottomWidth: 0 }}
        onBackPress={() => navigation.pop()}
        rightElement={(
          <SimpleButton
            title={t`Manual`}
            onPress={() => navigation.navigate('RegisterOptions')}
          />
        )}
      />
      <View style={{ flex: 1, margin: 16, alignSelf: 'stretch' }}>
        <QRCodeReader
          onSuccess={onSuccess}
          bottomText={t`Scan the QR code`}
          navigation={navigation}
        />
      </View>
      <OfflineBar />
    </SafeAreaView>
  );
};

export default UnifiedQRScanner;
