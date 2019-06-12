import React from 'react';
import { Alert, Keyboard, Platform, SafeAreaView, Text, TouchableWithoutFeedback, View } from 'react-native';
import { connect } from 'react-redux';

import ModalTop from '../components/ModalTop';
import QRCodeReader from '../components/QRCodeReader';
import HathorButton from '../components/HathorButton';
import HathorTextInput from '../components/HathorTextInput';
import { newToken } from '../hathorRedux';

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
    const getTopContent = () => {
      return (
        <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
          <HathorTextInput
            style={{ width: 320 }}
            placeholder="Enter the configuration string here"
            multiline = {true}
            blurOnSubmit={true}
            returnKeyType="done"
            clearButtonMode="while-editing"
            onChangeText={(text) => this.setState({configurationString: text})}
            value={this.state.configurationString} />
          <HathorButton 
            style={{ marginTop: 8 }}
            onPress={() => this.validateAndAdd(this.state.configurationString)}
            title="Add token" />

          <View style={{ marginTop: Platform.OS === 'ios' ? 24 : 12 }}>
            <Text style={{ textAlign: "center" }}>Or scan the QR code.</Text>
          </View>
          
        </View>
      )
    }

    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ModalTop title='New token' navigation={this.props.navigation} />
            {getTopContent()}
            <QRCodeReader
              ref={(el) => this.QRCodeReader = el}
              onSuccess={this.onSuccess}
              topContent={null}
              bottomContent={null}
              {...this.props} />
          </View>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    );
  }
}

export default connect(null)(RegisterToken);
