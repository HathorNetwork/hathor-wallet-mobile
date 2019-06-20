import React from 'react';
import { Alert, Keyboard, Platform, SafeAreaView, Text, TouchableWithoutFeedback, View } from 'react-native';
import { connect } from 'react-redux';

import HathorHeader from '../components/HathorHeader';
import QRCodeReader from '../components/QRCodeReader';
import { newToken } from '../actions';

import hathorLib from '@hathor/wallet-lib';


class RegisterToken extends React.Component {
  constructor(props) {
    super(props);

    this.QRCodeReader = null;

    this.state = {
      configurationString: '',
    }
  }

  showError = (message) => {
    Alert.alert(
      "Error adding token",
      message,
      [
        {text: "OK", onPress: this.QRCodeReader.reactivateQrCodeScanner},
      ],
      {cancelable: false},
    );
  }

  showSuccessAlert = (token) => {
    Alert.alert(
      "Confirm new token",
      `Are you sure you want to add the token ${token.name}?`,
      [
        {text: "Yes", onPress: () => {this.addToken(token)}},
        {text: "Cancel", style: "cancel", onPress: this.QRCodeReader.reactivateQrCodeScanner},
      ],
      {cancelable: false},
    );
  }

  addToken = (token) => {
    hathorLib.tokens.addToken(token.uid, token.name, token.symbol);
    this.props.dispatch(newToken(token));
    this.props.navigation.goBack();
  }

  validateAndAdd = (configurationString) => {
    const result = hathorLib.tokens.validateTokenToAddByConfigurationString(configurationString); 
    if (result.success) {
      this.showSuccessAlert(result.tokenData);
    } else {
      this.showError(result.message);
    }
  }

  onSuccess = (e) => {
    this.validateAndAdd(e.data);
  }

  render() {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#f7f7f7', alignSelf: 'stretch' }}>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", alignSelf: 'stretch' }}>
          <HathorHeader
            title='REGISTER TOKEN'
            onBackPress={() => this.props.navigation.goBack()}
            wrapperStyle={{ borderBottomWidth: 0 }}
          />
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", margin: 16, alignSelf: 'stretch' }}>
            <QRCodeReader
              ref={(el) => this.QRCodeReader = el}
              onSuccess={this.onSuccess}
              bottomText='Scan the QR code'
              {...this.props} />
          </View>
        </SafeAreaView>
      </View>
    );
  }
}

export default connect(null)(RegisterToken);
