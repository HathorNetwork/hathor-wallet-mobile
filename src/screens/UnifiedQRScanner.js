/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { SafeAreaView, View, Alert } from 'react-native';
import { t } from 'ttag';
import { useDispatch } from 'react-redux';
import { reownUriInputted } from '../actions';
import QRCodeReader from '../components/QRCodeReader';
import OfflineBar from '../components/OfflineBar';
import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';
import { COLORS } from '../styles/themes';

const UnifiedQRScanner = ({ navigation }) => {
  const dispatch = useDispatch();

  const onSuccess = (e) => {
    const qrData = e.data;

    // Regex patterns for different types
    const reownPattern = /^wc:[a-f0-9]+@\d+\?.*$/;
    const tokenPattern = /^\[.*:.*:.*:.*\]$/;
    const nanoContractPattern = /^[a-f0-9]{64}$/;

    // Check if it's a reown URI
    if (reownPattern.test(qrData)) {
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
      navigation.replace('NanoContractRegisterScreen', { ncId: qrData });
      return;
    }

    // If none of the patterns match, show an error or handle accordingly
    Alert.alert(
      t`Invalid QR Code`,
      t`The scanned QR code is not in a recognized format.`,
      [{ text: t`OK` }]
    );
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