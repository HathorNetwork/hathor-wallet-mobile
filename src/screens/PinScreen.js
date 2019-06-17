import React from "react";
import { Image, SafeAreaView, Text, View } from "react-native";
import * as Keychain from 'react-native-keychain';
import HathorButton from "../components/HathorButton";
import HathorTextInput from '../components/HathorTextInput';
import { isBiometryEnabled, getSupportedBiometry } from '../utils';

import hathorLib from '@hathor/wallet-lib';

class PinScreen extends React.Component {
  constructor(props) {
    super(props);
    /**
     * pin {string} Pin entered by the user
     * error {boolean} If pin was incorrect
     */
    this.state = {pin: "", error: false};
    this.canCancel = props.navigation.getParam('canCancel', false);
    this.screenText = props.navigation.getParam('screenText', 'Use your 6-digit pin to unlock Hathor Wallet');
    this.biometryText = props.navigation.getParam('biometryText', 'Unlock Hathor Wallet');
  }

  componentDidMount() {
    const supportedBiometry = getSupportedBiometry();
    const biometryEnabled = isBiometryEnabled();
    if (supportedBiometry && biometryEnabled) {
      this.askBiometricId();
    }
  }

  askBiometricId = () => {
    Keychain.getGenericPassword({authenticationPrompt: this.biometryText}).then(credentials => {
      this.dismiss(credentials.password);
    }, error => {
      // no need to do anything as user can enter pin
      console.log('error keychain', error);
    });
  }

  dismiss = (pin) => {
    // execute the callback passing the pin, if any cb was given
    const cb = this.props.navigation.getParam('cb', null);
    if (cb) {
      cb(pin);
    }
    this.props.navigation.goBack();
  }

  onChangeText = (text) => {
    if (text.length === 6) {
      if (hathorLib.wallet.isPinCorrect(text)) {
        this.dismiss(text);
      } else {
        this.setState({ pin: "", error: true });
      }
    } else {
      this.setState({ pin: text, error: false });
    }
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center" }}>
        <View style={{ height: 30, width: 170, marginTop: 16, marginBottom: 16 }}>
          <Image
            source={require('../assets/images/hathor-logo.png')}
            style={{height: 30, width: 170 }}
            resizeMode={"contain"}
          /> 
        </View>
        <Text>{this.screenText}</Text>
        <HathorTextInput
          style={{fontSize: 24, width: 120, padding: 12, marginTop: 16}}
          onChangeText={this.onChangeText}
          value={this.state.pin}
          keyboardType="number-pad"
          secureTextEntry={true}
          autoFocus={true}
        />
        <HathorButton
          onPress={() => this.props.navigation.goBack()}
          title="Cancel"
          style={{ marginTop: 32 }}
        />
        {this.state.error && <Text style={{ color: 'red', marginTop: 16 }}>Incorrect pin</Text>}
      </SafeAreaView>
    )
  }
}

export { PinScreen };
