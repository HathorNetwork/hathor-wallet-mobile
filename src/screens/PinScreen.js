import React from "react";
import { BackHandler, Image, SafeAreaView, Text, View } from "react-native";
import * as Keychain from 'react-native-keychain';
import HathorButton from "../components/HathorButton";
import SimpleButton from '../components/SimpleButton';
import PinInput from '../components/PinInput';
import { isBiometryEnabled, getSupportedBiometry } from '../utils';

import hathorLib from '@hathor/wallet-lib';

class PinScreen extends React.Component {
  constructor(props) {
    super(props);
    /**
     * pin {string} Pin entered by the user
     * error {boolean} If pin was incorrect
     */
    this.state = {
      pin: '',
      pinColor: 'black',
      error: false,
    };
    this.canCancel = props.navigation.getParam('canCancel', false);
    this.screenText = props.navigation.getParam('screenText', 'Enter your PIN Code ');
    this.biometryText = props.navigation.getParam('biometryText', 'Unlock Hathor Wallet');

    this.willFocusEvent = null;
    this.pinInputRef = React.createRef();
  }

  componentDidMount() {
    const supportedBiometry = getSupportedBiometry();
    const biometryEnabled = isBiometryEnabled();
    if (supportedBiometry && biometryEnabled) {
      this.askBiometricId();
    }

    if (!this.canCancel) {
      // If can't cancel this screen, we must remove the hardware back from android
      BackHandler.addEventListener('hardwareBackPress', this.handleBackButton);
    }

    const { navigation } = this.props;
    this.willFocusEvent = navigation.addListener('willFocus', () => {
      if (this.pinInputRef.current) {
        // Reset PIN value and focus on input
        this.setState({ pin: '', pinColor: 'black', error: false }, () => {
          this.pinInputRef.current.focus();
        })
      }
    });
  }

  componentWillUnmount() {
    if (!this.canCancel) {
      // Removing event listener
      BackHandler.removeEventListener('hardwareBackPress', this.handleBackButton);
    }

    // Removing focus event
    this.willFocusEvent.remove();
  }

  handleBackButton = () => {
    return true;
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
    // dismiss the pin screen first because doing it after the callback can
    // end up dismiss the wrong screen
    this.props.navigation.goBack();
    // execute the callback passing the pin, if any cb was given
    const cb = this.props.navigation.getParam('cb', null);
    if (cb) {
      cb(pin);
    }
  }

  onChangeText = (text) => {
    if (text.length === 6) {
      setTimeout(() => this.validatePin(text), 300);
    }
    this.setState({ pin: text, pinColor: 'black', error: false });
  }

  validatePin = (text) => {
    if (hathorLib.wallet.isPinCorrect(text)) {
      this.dismiss(text);
    } else {
      this.removeOneChar();
    }
  }

  removeOneChar() {
    const pin = this.state.pin.slice(0, -1);
    if (pin.length == 0) {
      this.setState({ pin: "", error: true });
    } else {
      this.setState({ pin: pin, pinColor: '#DE3535' });
      setTimeout(() => this.removeOneChar(), 25);
    }
  }

  render() {
    const renderResetButton = () => {
      return (
        <SimpleButton
          onPress={() => this.props.navigation.navigate('ResetWallet')}
          title="Reset Wallet"
          color='#0273a0'
          textStyle={{ textTransform: 'uppercase' }}
          containerStyle={{ marginTop: 48, marginHorizontal: 32 }}
        />
      )
    }

    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center" }}>
        <View style={{ height: 30, width: 170, marginTop: 16, marginBottom: 16 }}>
          <Image
            source={require('../assets/images/hathor-logo.png')}
            style={{height: 30, width: 170 }}
            resizeMode={"contain"}
          /> 
        </View>
        <Text style={{marginTop: 32, marginBottom: 16}}>{this.screenText}</Text>
        <PinInput
          maxLength={6}
          color={this.state.pinColor}
          onChangeText={this.onChangeText}
          value={this.state.pin}
          autoFocus={true}
          ref={this.pinInputRef}
        />
        {this.canCancel && <SimpleButton
          onPress={() => this.props.navigation.goBack()}
          title="Cancel"
          color='#0273a0'
          textStyle={{ textTransform: 'uppercase' }}
          containerStyle={{ marginTop: 32 }}
        />}
        {!this.canCancel && renderResetButton()}
        {this.state.error && <Text style={{ color: '#DE3535', marginTop: 16 }}>Incorrect PIN Code. Try again.</Text>}
      </SafeAreaView>
    )
  }
}

export { PinScreen };
