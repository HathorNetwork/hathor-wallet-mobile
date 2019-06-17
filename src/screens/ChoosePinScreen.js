import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  View
} from 'react-native';
import HathorButton from '../components/HathorButton';
import HathorTextInput from '../components/HathorTextInput';

class ChoosePinScreen extends React.Component {
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
          <View style={{flex: 1, padding: 16, marginTop: 8, justifyContent: 'flex-start', alignItems: 'center'}}>
            <Text>Choose a <Text style={{fontWeight: 'bold'}}>6 digit pin code</Text> to authorize transactions and unlock your wallet.</Text>
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
            <HathorButton
              style={{marginTop: 16}}
              onPress={this.loadClicked}
              disabled={this.state.error !== null}
              title="Go"
              style={{ marginTop: 8 }}
            />
            <Text style={{ color: 'red' }}>{this.state.error}</Text>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }
}

export default ChoosePinScreen;
