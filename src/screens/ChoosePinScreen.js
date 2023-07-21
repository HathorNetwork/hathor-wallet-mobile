/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';

import NewHathorButton from '../components/NewHathorButton';
import HathorHeader from '../components/HathorHeader';
import PinInput from '../components/PinInput';
import { startWalletRequested, unlockScreen } from '../actions';
import { ERROR_BG_COLOR, PIN_SIZE } from '../constants';

import baseStyle from '../styles/init';
import { STORE } from '../store';
import NavigationService from '../NavigationService';

const mapDispatchToProps = (dispatch) => ({
  unlockScreen: () => dispatch(unlockScreen()),
  startWalletRequested: (words, pin) => dispatch(startWalletRequested({
    words,
    pin
  })),
});

class ChoosePinScreen extends React.Component {
  style = ({ ...baseStyle,
    ...StyleSheet.create({
      pinView: {
        flex: 1,
        alignItems: 'center',
      },
      pinText: {
        marginTop: 16,
        marginBottom: 16,
      },
    }) });

  constructor(props) {
    super(props);
    this.words = this.props.route.params?.words; // Mandatory parameter

    /**
     * pin1 {string} Input value for pin
     * pin2 {string} Input value for pin confirmation
     * pin2Color {string} Color of the pin2's PinInput markers
     * error {string} Error message to be shown if pins do not match
     * done {boolean} Indicates whether we're ready to move to the next screen
     * stepIndex {integer} Indicates in which step of the screen we are.
     *   Step 0: Set a pin
     *   Step 1: Confirm the pin
     */
    this.state = {
      pin1: '',
      pin2: '',
      pin2Color: 'black',
      error: null,
      done: false,
      stepIndex: 0,
    };

    this.steps = [
      {
        title: t`Create a new PIN code,`,
        render: this.getPin1View,
      }, {
        title: t`To confirm the PIN,`,
        render: this.getPin2View,
      },
    ];
  }

  goToNextScreen = () => {
    STORE.initStorage(this.words, this.state.pin1).then(() => {
      // we are just initializing the wallet, so make sure it's not locked when going to AppStack
      this.props.unlockScreen();
      this.props.startWalletRequested(this.words, this.state.pin1);
      NavigationService.resetToMain();
    });
  }

  startPinAgain = () => {
    this.setState({
      pin1: '',
      pin2: '',
      pin2Color: 'black',
      error: null,
      stepIndex: 0,
    });
  }

  onChangePin1 = (text) => {
    if (text.length > PIN_SIZE) {
      return;
    }

    this.setState({ pin1: text });
    if (text.length === PIN_SIZE) {
      setTimeout(this.moveToPin2, 500);
    }
  }

  moveToPin2 = () => {
    this.setState({
      stepIndex: 1,
    });
  }

  onChangePin2 = (text) => {
    if (text.length > PIN_SIZE) {
      return;
    }

    this.setState({ pin2: text, pin2Color: 'black', error: null });
    if (text.length === PIN_SIZE) {
      setTimeout(() => this.validatePin(text), 300);
    }
  }

  validatePin = (text) => {
    if (this.state.pin1 === text) {
      this.setState({ pin2Color: '#0DA0A0', done: true });
    } else {
      this.removeOneChar();
    }
  }

  getPin1View = () => (
    <View style={this.style.pinView}>
      <Text style={this.style.pinText}>{t`Enter your new PIN code`}</Text>
      <PinInput
        maxLength={PIN_SIZE}
        onChangeText={this.onChangePin1}
        color={(this.state.pin1.length < PIN_SIZE ? 'black' : '#0DA0A0')}
        value={this.state.pin1}
      />
    </View>
  )

  getPin2View = () => (
    <View style={this.style.pinView}>
      <Text style={this.style.pinText}>{t`Enter your new PIN code again`}</Text>
      <PinInput
        maxLength={PIN_SIZE}
        onChangeText={this.onChangePin2}
        color={this.state.pin2Color}
        value={this.state.pin2}
        error={this.state.error}
      />
    </View>
  )

  removeOneChar() {
    const pin2 = this.state.pin2.slice(0, -1);
    if (pin2.length === 0) {
      this.setState({ pin2: '', error: t`PIN codes don't match. Try again.` });
    } else {
      this.setState({ pin2, pin2Color: ERROR_BG_COLOR });
      setTimeout(() => this.removeOneChar(), 25);
    }
  }

  render() {
    const step = this.steps[this.state.stepIndex];
    return (
      <View style={{ flex: 1 }}>
        <HathorHeader
          withLogo
          onBackPress={() => this.props.navigation.goBack()}
        />
        <View style={this.style.container}>
          <Text style={this.style.title}>{step.title}</Text>

          {step.render()}

          <NewHathorButton
            onPress={this.goToNextScreen}
            disabled={!this.state.done}
            title={t`Start the Wallet`}
            style={{ marginTop: 16 }}
          />
        </View>
      </View>
    );
  }
}

export default connect(null, mapDispatchToProps)(ChoosePinScreen);
