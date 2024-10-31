/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { View } from 'react-native';
import { t } from 'ttag';

import HathorHeader from '../components/HathorHeader';
import QRCodeReader from '../components/QRCodeReader';
import SimpleButton from '../components/SimpleButton';
import { COLORS } from '../styles/themes';

export const NanoContractRegisterQrCodeScreen = ({ navigation }) => {
  const onSuccess = (e) => {
    navigation.navigate('NanoContractRegisterScreen', { ncId: e.data });
  }

  const renderHeaderRightElement = () => (
    <SimpleButton
      // translator: Used when the QR Code Scanner is opened, and user will manually
      // enter the information.
      title={t`Manual info`}
      onPress={() => navigation.navigate('NanoContractRegisterScreen')}
    />
  );

  return (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: COLORS.lowContrastDetail,
      alignSelf: 'stretch',
    }}
    >
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'stretch',
      }}
      >
        <HathorHeader
          title={t`Nano Contract Registration`.toUpperCase()}
          onBackPress={() => navigation.pop()}
          rightElement={renderHeaderRightElement()}
        />
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          margin: 16,
          alignSelf: 'stretch',
        }}
        >
          <QRCodeReader
            navigation={navigation}
            onSuccess={onSuccess}
            bottomText={t`Scan the nano contract ID QR code`}
          />
        </View>
      </View>
    </View>
  );
}

export default NanoContractRegisterQrCodeScreen;
