/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { SafeAreaView, View } from 'react-native';
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

    // Check if it's a token registration QR code
    if (qrData.startsWith('hathor:')) {
      navigation.replace('RegisterTokenManual', { configString: qrData });
      return;
    }

    // Check if it's a nano contract QR code
    try {
      const nanoContractData = JSON.parse(qrData);
      if (nanoContractData.type === 'nano-contract') {
        navigation.replace('NanoContractRegisterScreen', { nanoContractData });
        return;
      }
    } catch (err) {
      // Not a JSON or not a nano contract, continue to next check
    }

    // If none of the above, assume it's a reown URI
    dispatch(reownUriInputted(qrData));
    navigation.replace('ReownList');
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