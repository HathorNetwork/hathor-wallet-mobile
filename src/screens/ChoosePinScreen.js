import React from 'react';
import {
  Keyboard,
  SafeAreaView,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { connect } from 'react-redux';

import NewHathorButton from '../components/NewHathorButton';
import SimpleButton from '../components/SimpleButton';
import HathorTextInput from '../components/HathorTextInput';
import PinInput from '../components/PinInput';
import { setInitWallet, unlockScreen } from '../actions';

import baseStyle from '../styles/init';
import { Strong } from '../utils';


const mapDispatchToProps = dispatch => {
  return {
    unlockScreen: () => dispatch(unlockScreen()),
    setInitWallet: (words, pin) => dispatch(setInitWallet(words, pin)),
  }
}

class ChoosePinScreen extends React.Component {
  style = Object.assign({}, baseStyle, StyleSheet.create({
    pinView: {
      flex: 1,
      alignItems: 'center',
    },
    pinText: {
      marginTop: 32,
      marginBottom: 16,
    },
  }));

  constructor(props) {
    super(props);
    this.words = this.props.navigation.getParam("words");

    /**
     * pin1 {string} Input value for pin
     * pin2 {string} Input value for pin confirmation
     * pin2Color {string} Color of the pin2's PinInput markers
     * error {string} Error message to be shown if pin is not valid or pins do not match
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
        title: 'For your security,',
        render: this.getPin1View
      }, {
        title: 'To confirm the PIN,',
        render: this.getPin2View
      },
    ];
  }

  startPinAgain = () => {
    this.setState({
      pin1: '',
      pin2: '',
      pin2Color: 'black',
      error: false,
      stepIndex: 0,
    });
  }

  onChangePin1 = (text) => {
    this.setState({ pin1: text });
    if (text.length == 6) {
      setTimeout(this.moveToPin2, 500);
    }
  }

  moveToPin2 = () => {
    this.setState({
      stepIndex: 1
    });
  }

  onChangePin2 = (text) => {
    this.setState({pin2: text, pin2Color: 'black', error: null});
    if (text.length == 6) {
      setTimeout(() => this.validatePin(text), 300);
    }
  }

  validatePin = (text) => {
    if (this.state.pin1 === this.state.pin2) {
      this.setState({ pin2Color: '#0DA0A0', done: true });
      Keyboard.dismiss();
    } else {
      this.removeOneChar();
    }
  }

  removeOneChar() {
    const pin2 = this.state.pin2.slice(0, -1);
    if (pin2.length == 0) {
      this.setState({ pin2: "", error: true });
    } else {
      this.setState({ pin2: pin2, pin2Color: '#DE3535' });
      setTimeout(() => this.removeOneChar(), 25);
    }
  }

  getPin1View = () => {
    return (
      <View style={this.style.pinView}>
        <Text style={this.style.pinText}>Enter your new PIN code</Text>
        <PinInput
          editable={!this.state.done && this.state.stepIndex == 0}
          maxLength={6}
          onChangeText={this.onChangePin1}
          color={(this.state.pin1.length < 6 ? 'black' : '#0DA0A0')}
          value={this.state.pin1}
          autoFocus={true}
        />
      </View>
    );
  }

  getPin2View = () => {
    let errorMessage = '';
    if (this.state.error) {
      errorMessage = 'Incorrect PIN Code. Try again.';
    }
    return (
      <View style={this.style.pinView}>
        <Text style={this.style.pinText}>Enter your new PIN code again</Text>
        <PinInput
          editable={!this.state.done && this.state.stepIndex == 1}
          maxLength={6}
          onChangeText={this.onChangePin2}
          color={this.state.pin2Color}
          value={this.state.pin2}
          autoFocus={true}
        />
        <Text style={{ color: '#DE3535', marginTop: 16, height: 24 }}>{errorMessage}</Text>
        {(!this.state.done &&
          <SimpleButton
            onPress={this.startPinAgain}
            title='Choose another PIN'
            color='#0273a0'
            textStyle={{ fontSize: 18 }}
            containerStyle={{ marginTop: 32 }}
          />
        )}
      </View>
    );
  }

  goToNextScreen = () => {
    this.props.setInitWallet(this.words, this.state.pin1);
    // we are just initializing the wallet, so make sure it's not locked when going to AppStack
    this.props.unlockScreen();
    this.props.navigation.navigate('Home');
  }

  render() {
    const step = this.steps[this.state.stepIndex];
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={this.style.container}>
          <Text style={this.style.title}>{step.title}</Text>

          {step.render()}

          <View style={this.style.buttonView}>
            <NewHathorButton
              onPress={this.goToNextScreen}
              disabled={!this.state.done}
              title='Start the Wallet'
              style={{ marginTop: 16 }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

export default connect(null, mapDispatchToProps)(ChoosePinScreen);
