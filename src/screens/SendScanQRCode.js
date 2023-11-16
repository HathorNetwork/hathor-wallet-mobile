/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Alert, View } from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';

import QRCodeReader from '../components/QRCodeReader';
import OfflineBar from '../components/OfflineBar';
import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';
import { getTokenLabel, parseQRCode } from '../utils';
import { COLORS } from '../styles/themes';

const mapStateToProps = (state) => ({
  wallet: state.wallet,
  tokens: state.tokens,
});

class SendScanQRCode extends React.Component {
  constructor() {
    super();
    this.state = {
      isWaitingForUserInput: false,
    }
  }

  showAlertError = (message) => {
    this.setState({ isWaitingForUserInput: true });
    Alert.alert(
      t`Invalid QR code`,
      message,
      [
        { text: t`OK`,
          onPress: () => {
            // To avoid being stuck on an invalid QR code loop, navigate back.
            this.props.navigation.goBack();
            this.setState({ isWaitingForUserInput: false });
          } },
      ],
      { cancelable: false },
    );
  }

  onSuccess = async (e) => {
    if (this.state.isWaitingForUserInput) {
      // Avoid multiple calls to this function while waiting for user input
      return;
    }

    const qrcode = parseQRCode(e.data);
    if (!qrcode.isValid) {
      this.showAlertError(qrcode.error);
    } else if (qrcode.token && qrcode.amount) {
      const isTokenRegistered = this.props.tokens.some(
        (stateToken) => stateToken.uid === qrcode.token.uid
      );
      if (isTokenRegistered) {
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
      <View style={{ flex: 1, backgroundColor: COLORS.lowContrastDetail }}>
        <HathorHeader
          title={t`SEND`}
          rightElement={<ManualInfoButton />}
          wrapperStyle={{ borderBottomWidth: 0 }}
        />
        <View style={{ flex: 1, margin: 16, alignSelf: 'stretch' }}>
          <QRCodeReader
            navigation={this.props.navigation}
            onSuccess={this.onSuccess}
            bottomText={t`Scan the QR code`}
          />
        </View>
        <OfflineBar />
      </View>
    );
  }
}

export default connect(mapStateToProps)(SendScanQRCode);
