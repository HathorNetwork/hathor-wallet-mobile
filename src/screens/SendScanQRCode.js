/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Alert, Platform, SafeAreaView, View } from 'react-native';
import { request, check, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { connect } from 'react-redux';
import { t } from 'ttag';

import QRCodeReader from '../components/QRCodeReader';
import OfflineBar from '../components/OfflineBar';
import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';
import { getTokenLabel, parseQRCode } from '../utils';
import { LIGHT_BG_COLOR } from '../constants';

const mapStateToProps = (state) => ({
  wallet: state.wallet,
});

async function requestCameraPermissions() {
  const checkStatus = async (status) => {
    switch (status) {
      case RESULTS.UNAVAILABLE:
        return false;
      case RESULTS.GRANTED:
        return true;
      case RESULTS.DENIED:
        return checkStatus(await request(platformPermission));
      case RESULTS.BLOCKED:
        return false;
      default:
        return false;
    }
  };

  const platformPermission = Platform.OS === 'android'
    ? PERMISSIONS.ANDROID.CAMERA
    : PERMISSIONS.IOS.CAMERA;
  const currentStatus = await check(platformPermission);
  return checkStatus(currentStatus);
}

class SendScanQRCode extends React.Component {
  constructor() {
    super();

    this.state = {
      renderCodeReader: false,
    };
  }

  showAlertError = (message) => {
    Alert.alert(
      t`Invalid QR code`,
      message,
      [
        { text: t`OK`,
          onPress: () => {
            // To avoid being stuck on an invalid QR code loop, navigate back.
            this.props.navigation.goBack();
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

  async componentDidMount() {
    const cameraPermissions = await requestCameraPermissions();

    if (!cameraPermissions) {
      this.props.navigation.replace('SendAddressInput');
    } else {
      this.setState({ renderCodeReader: true });
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
      <SafeAreaView style={{ flex: 1, backgroundColor: LIGHT_BG_COLOR }}>
        <HathorHeader
          title={t`SEND`}
          rightElement={<ManualInfoButton />}
          wrapperStyle={{ borderBottomWidth: 0 }}
        />
        <View style={{ flex: 1, margin: 16, alignSelf: 'stretch' }}>
          {this.state.renderCodeReader && (
            <QRCodeReader
              navigation={this.props.navigation}
              onSuccess={this.onSuccess}
              bottomText={t`Scan the QR code`}
            />
          )}
        </View>
        <OfflineBar />
      </SafeAreaView>
    );
  }
}

export default connect(mapStateToProps)(SendScanQRCode);
