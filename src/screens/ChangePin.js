import React from 'react';
import {
  Image,
  SafeAreaView,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import hathorLib from '@hathor/wallet-lib';

import HathorHeader from '../components/HathorHeader';
import PinInput from '../components/PinInput';
import FeedbackModal from '../components/FeedbackModal';
import baseStyle from '../styles/init';
import { Strong } from '../utils';
import checkIcon from '../assets/images/icCheckBig.png';


class ChangePin extends React.Component {
  style = Object.assign({}, baseStyle, StyleSheet.create({
    pinView: {
      flex: 1,
      alignItems: 'center',
    },
    pinText: {
      marginTop: 80,
      marginBottom: 16,
    },
  }));

  constructor(props) {
    super(props);
    /**
     * pin1 {string} Input value for your current pin
     * pin2 {string} Input value for the new pin
     * pin3 {string} Input value for the new pin confirmation
     * pin1Color {string} Color of the pin1's PinInput markers
     * pin3Color {string} Color of the pin3's PinInput markers
     * done {boolean} If step 3 was already completed with success
     * error {string} Error message to be shown if pins do not match
     * stepIndex {integer} Indicates in which step of the screen we are.
     *   Step 0: Type current PIN
     *   Step 1: Type new PIN
     *   Step 2: Confirm the new PIN
     */
    this.state = {
      pin1: '',
      pin2: '',
      pin3: '',
      pin1Color: 'black',
      pin3Color: 'black',
      done: false,
      error: '',
      stepIndex: 0,
    };

    this.steps = [
      {
        render: this.getPin1View,
      }, {
        render: this.getPin2View,
      }, {
        render: this.getPin3View,
      },
    ];
  }

  exitScreen = () => {
    this.props.navigation.goBack();
  }

  startPinAgain = () => {
    this.setState({
      pin1: '',
      pin2: '',
      pin3: '',
      pin1Color: 'black',
      pin3Color: 'black',
      error: null,
      stepIndex: 0,
    });
  }

  onChangePin1 = (text) => {
    this.setState({ pin1: text, pin1Color: 'black', error: null });
    if (text.length === 6) {
      setTimeout(() => this.validatePin1(text), 300);
    }
  }

  validatePin1 = (text) => {
    if (hathorLib.wallet.isPinCorrect(text)) {
      this.nextStep();
    } else {
      this.removeOneChar('pin1', 'pin1Color', 'Incorrect PIN code.');
    }
  }

  nextStep = () => {
    this.setState(prevState => ({ stepIndex: prevState.stepIndex + 1 }));
  }

  onChangePin2 = (text) => {
    this.setState({ pin2: text });
    if (text.length === 6) {
      setTimeout(this.nextStep, 500);
    }
  }

  onChangePin3 = (text) => {
    this.setState({ pin3: text, pin3Color: 'black', error: null });
    if (text.length === 6) {
      setTimeout(() => this.validatePin3(text), 300);
    }
  }

  validatePin3 = (text) => {
    if (this.state.pin2 === text) {
      this.setState({ pin3Color: '#0DA0A0' });
      this.executeChangePin();
    } else {
      this.removeOneChar('pin3', 'pin3Color', 'PIN codes don\'t match.');
    }
  }

  removeOneChar = (stateKey, stateColorKey, error) => {
    const pin = this.state[stateKey].slice(0, -1);
    if (pin.length === 0) {
      const newState = { error };
      newState[stateKey] = '';
      this.setState(newState);
    } else {
      const newState = {};
      newState[stateKey] = pin;
      newState[stateColorKey] = '#DE3535';
      this.setState(newState);
      setTimeout(() => this.removeOneChar(stateKey, stateColorKey, error), 25);
    }
  }

  executeChangePin = () => {
    const success = hathorLib.wallet.changePin(this.state.pin1, this.state.pin2);
    if (success) {
      this.setState({ done: true });
    } else {
      // Should never get here because we've done all the validations before
      this.removeOneChar('pin3', 'pin3Color', 'Error while changing PIN');
    }
  }

  getPin1View = () => (
    <View style={this.style.pinView}>
      <Text style={this.style.pinText}>Please enter your <Strong>current PIN</Strong></Text>
      <PinInput
        maxLength={6}
        onChangeText={this.onChangePin1}
        color={this.state.pin1Color}
        value={this.state.pin1}
        error={this.state.error}
      />
    </View>
  )

  getPin2View = () => (
    <View style={this.style.pinView}>
      <Text style={this.style.pinText}>Please enter your <Strong>new PIN</Strong></Text>
      <PinInput
        maxLength={6}
        onChangeText={this.onChangePin2}
        color={(this.state.pin2.length < 6 ? 'black' : '#0DA0A0')}
        value={this.state.pin2}
        error={this.state.error}
      />
    </View>
  );

  getPin3View = () => (
    <View style={this.style.pinView}>
      <Text style={this.style.pinText}>Please enter your <Strong>new PIN</Strong> again</Text>
      <PinInput
        maxLength={6}
        onChangeText={this.onChangePin3}
        color={this.state.pin3Color}
        value={this.state.pin3}
        error={this.state.error}
      />
    </View>
  );

  render() {
    const renderSuccessModal = () => (
      <FeedbackModal
        icon={<Image source={checkIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />}
        text='New PIN recorded'
        onDismiss={this.exitScreen}
      />
    );

    const step = this.steps[this.state.stepIndex];
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          withBorder
          title='CHANGE PIN'
          onBackPress={() => this.props.navigation.goBack()}
        />
        <View style={this.style.container}>
          {step.render()}
        </View>
        {this.state.done && renderSuccessModal()}
      </SafeAreaView>
    );
  }
}

export default ChangePin;
