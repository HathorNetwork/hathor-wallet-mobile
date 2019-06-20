import React from 'react';
import { ActivityIndicator, Alert, SafeAreaView, Text, View } from 'react-native';

import QRCodeReader from '../components/QRCodeReader';
import HathorButton from '../components/HathorButton';
import { getTokenLabel, parseQRCode } from '../utils';
import { connect } from 'react-redux';

import hathorLib from '@hathor/wallet-lib';


class SendScanQRCode extends React.Component {
  constructor(props) {
    super(props);

    this.QRCodeReader = null;
  }

  showAlertError = (message) => {
    Alert.alert(
      "Invalid QR code",
      message,
      [
        {text: "OK", onPress: this.QRCodeReader.reactivateQrCodeScanner},
      ],
      {cancelable: false},
    );
  }

  onSuccess = (e) => {
    const qrcode = parseQRCode(e.data);
    if (!qrcode.isValid) {
      this.showAlertError(qrcode.error);
    } else {
      if (qrcode.token && qrcode.amount) {
        if (hathorLib.tokens.tokenExists(qrcode.token.uid) === null) {
          // Wallet does not have the selected token
          this.showAlertError(`You don't have the requested token [${getTokenLabel(qrcode.token)}]`);
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
  }

  render() {
    const getTopContent = () => {
      return (
        <View>
          <Text>Scan the QR code with the transaction info.</Text>
        </View>
      );
    }

    const getBottomContent = () => {
      return (
        <HathorButton
          onPress={() => this.props.navigation.navigate('SendAddressInput')}
          title="Enter info manually"
        />
      )
    }

    return (
      <QRCodeReader
        ref={(el) => this.QRCodeReader = el}
        onSuccess={this.onSuccess}
        topContent={getTopContent()}
        bottomContent={getBottomContent()}
        {...this.props} />
    );
  }
}

export default SendScanQRCode;
