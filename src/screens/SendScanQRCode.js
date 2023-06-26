/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Alert, SafeAreaView, View } from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';

import QRCodeReader from '../components/QRCodeReaderNew';
import OfflineBar from '../components/OfflineBar';
import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';
import { getTokenLabel, parseQRCode } from '../utils';


const mapStateToProps = (state) => ({
  wallet: state.wallet,
});

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
        { text: t`OK`,
          onPress: () => {
            console.log(`Should reactivate but doesnt`);
          } },
      ],
      { cancelable: false },
    );
  }

  onSuccess = async (e) => {
    const qrcode = parseQRCode(e.data);
    if (!qrcode.isValid) {
      this.showAlertError(qrcode.error);
    } else if (qrcode.token && qrcode.amount) {
      if (await this.props.wallet.storage.isTokenRegistered(qrcode.token.uid)) {
        const params = {
          address: qrcode.address,
          token: qrcode.token,
          amount: qrcode.amount,
        };
        this.props.navigation.navigate('SendConfirmScreen', params);
      } else {
        // Wallet does not have the selected token
        const tokenLabel = getTokenLabel(qrcode.token);
        this.showAlertError(t`You don't have the requested token [${tokenLabel}]`);
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

export default connect(mapStateToProps)(SendScanQRCode);
