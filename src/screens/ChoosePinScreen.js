import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import NewHathorButton from '../components/NewHathorButton';
import HathorTextInput from '../components/HathorTextInput';

import baseStyle from '../styles/init';
import { Strong } from '../utils';

class ChoosePinScreen extends React.Component {
  style = baseStyle;

  constructor(props) {
    super(props);
    this.words = this.props.navigation.getParam("words");
    /**
     * pin1 {string} Input value for pin
     * pin2 {string} Input value for pin confirmation
     * error {string} Error message to be shown if pin is not valid or pins do not match
     */
    this.state = {pin1: '', pin2: '', error: null}
  }

  onChangePin1 = (text) => {
    if (text.length > 6) return;
    this.setState({pin1: text, error: null});
  }

  onChangePin2 = (text) => {
    if (text.length > 6) return;
    this.setState({pin2: text, error: null});
  }

  loadClicked = () => {
    if (this.state.pin1.length < 6) {
      this.setState({ error: 'Pin must have 6 digits' });
    } else if (this.state.pin1 === this.state.pin2) {
      this.setState({ error: '' });
      this.props.navigation.navigate('Home', {words: this.words, pin: this.state.pin1});
    } else {
      this.setState({ error: 'Fields must be equal' });
    }
  }

  render() {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : null} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={this.style.container}>
              <Text style={this.style.title}>Finally, a security step.</Text>
              <View>
                <Text style={this.style.text}>You must set a <Strong>6-digit pin code</Strong> that will be requested before some operations.</Text>
                <Text style={this.style.text}>You will need it both to unlock your wallet and to send transactions.</Text>
                <Text style={this.style.text}>If you <Strong>forget your pin</Strong>, you will <Strong>lose access</Strong> to your wallet. The only way to recover access is to reset your wallet and import your seed words.</Text>
              </View>
              <HathorTextInput
                style={{marginTop: 16}}
                onChangeText={this.onChangePin1}
                placeholder='6-digit pin'
                keyboardAppearance='dark'
                keyboardType="number-pad"
                secureTextEntry={true}
                autoFocus={true}
                value={this.state.pin1}
              />
              <HathorTextInput
                style={{marginTop: 8}}
                onChangeText={this.onChangePin2}
                placeholder='Repeat pin'
                keyboardAppearance='dark'
                keyboardType="number-pad"
                secureTextEntry={true}
                value={this.state.pin2}
              />
              <Text style={{ color: 'red' }}>{this.state.error}</Text>
              <View style={this.style.buttonView}>
                <NewHathorButton
                  style={{marginTop: 16}}
                  onPress={this.loadClicked}
                  disabled={this.state.error !== null}
                  title="Go"
                  style={{ marginTop: 8 }}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }
}

export default ChoosePinScreen;
