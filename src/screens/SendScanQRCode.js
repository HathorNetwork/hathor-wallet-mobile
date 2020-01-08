/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Alert, SafeAreaView, View } from 'react-native';
import { t } from 'ttag';

import hathorLib from '@hathor/wallet-lib';
import QRCodeReader from '../components/QRCodeReader';
import OfflineBar from '../components/OfflineBar';
import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';
import { getTokenLabel, parseQRCode } from '../utils';


class SendScanQRCode extends React.Component {
  constructor(props) {
    super(props);

    this.QRCodeReader = null;
  }

  showAlertError = (message) => {
    Alert.alert(
      t`Invalid QR code`,
      message,
      [
        { text: t`OK`, onPress: this.QRCodeReader.reactivateQrCodeScanner },
      ],
      { cancelable: false },
    );
  }

  onSuccess = (e) => {
    const qrcode = parseQRCode(e.data);
    if (!qrcode.isValid) {
      this.showAlertError(qrcode.error);
    } else if (qrcode.token && qrcode.amount) {
      if (hathorLib.tokens.tokenExists(qrcode.token.uid) === null) {
        // Wallet does not have the selected token
        const tokenLabel = getTokenLabel(qrcode.token);
        this.showAlertError(t`You don't have the requested token [${tokenLabel}]`);
      } else {
        const params = {
          address: qrcode.address,
          token: qrcode.token,
          amount: qrcode.amount,
        };
        this.props.navigation.navigate('SendConfirmScreen', params);
      }
    } else {
      const params = {
        address: qrcode.address,
      };
      this.props.navigation.navigate('SendAddressInput', params);
    }
  }

  render() {
    const ManualInfoButton = () => (
      <SimpleButton
        withBorder
        // translator: Used when the QR Code Scanner is opened, and user will manually
        // enter the information.
        title={t`Manual info`}
        onPress={() => this.props.navigation.navigate('SendAddressInput')}
      />
    );

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f7f7' }}>
        <HathorHeader
          title={t`SEND`}
          rightElement={<ManualInfoButton />}
          wrapperStyle={{ borderBottomWidth: 0 }}
        />
        <View style={{ flex: 1, margin: 16, alignSelf: 'stretch' }}>
          <QRCodeReader
            ref={(el) => { this.QRCodeReader = el; }}
            onSuccess={this.onSuccess}
            bottomText={t`Scan the QR code`}
            {...this.props}
          />
        </View>
        <OfflineBar />
      </SafeAreaView>
    );
  }
}

export default SendScanQRCode;
