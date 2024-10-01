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

import QRCodeReader from '../../components/QRCodeReader';
import OfflineBar from '../../components/OfflineBar';
import HathorHeader from '../../components/HathorHeader';
import SimpleButton from '../../components/SimpleButton';
import { reownUriInputted } from '../../actions';
import { COLORS } from '../../styles/themes';

export default function WalletConnectScan({ navigation }) {
  const dispatch = useDispatch();

  const onSuccess = (e) => {
    dispatch(reownUriInputted(e.data));

    navigation.navigate('WalletConnectList');

    return null;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.lowContrastDetail }}>
      <HathorHeader
        title={t`Connect`}
        wrapperStyle={{ borderBottomWidth: 0 }}
        onBackPress={() => navigation.pop()}
        rightElement={(
          <SimpleButton
            // translator: Used when the QR Code Scanner is opened, and user will manually
            // enter the information.
            title={t`Manual`}
            onPress={() => navigation.navigate('WalletConnectManual')}
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
}
