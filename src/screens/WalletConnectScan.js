/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, {useEffect} from 'react';
import { SafeAreaView, View } from 'react-native';
import { t } from 'ttag';
import { useDispatch } from 'react-redux';

import QRCodeReader from '../components/QRCodeReader';
import OfflineBar from '../components/OfflineBar';
import HathorHeader from '../components/HathorHeader';
import { walletConnectQRCodeRead } from '../actions';

export default function WalletConnectScan({ navigation }) {
  const dispatch = useDispatch();

  const onSuccess = (e) => {
    dispatch(walletConnectQRCodeRead(e.data));

    return null;
  };

  useEffect(() => {
    setTimeout(() => {
      dispatch(walletConnectQRCodeRead('wc:23b5e237-9920-4ae4-bcbc-9aa1d5e923ab@1?bridge=https%3A%2F%2F8.bridge.walletconnect.org&key=f854515d3d727ecfe22f00dc2f66cdfe83070bfaaa9004c7739137a568775ed4'));
    }, 1000);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f7f7' }}>
      <HathorHeader
        title={t`SEND`}
        wrapperStyle={{ borderBottomWidth: 0 }}
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
