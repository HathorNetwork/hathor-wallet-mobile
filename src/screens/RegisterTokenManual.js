import React from 'react';
import {
  Keyboard, KeyboardAvoidingView, SafeAreaView, StyleSheet, Text, View,
} from 'react-native';

import { connect } from 'react-redux';
import hathorLib from '@hathor/wallet-lib';
import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';

import { getKeyboardAvoidingViewTopDistance, Strong } from '../utils';

import { newToken, updateSelectedToken } from '../actions';


class RegisterTokenManual extends React.Component {
  /**
   * This screen expect the following parameters on the navigation:
   * configurationString {string} Optional configuration string read from the qrcode
   */
  constructor(props) {
    super(props);
    /**
     * configurationString {string} The value of the configuration string input
     * errorMessage {string} Error with the configuration string
     * token {Object} Config of the token from the configuration string (if valid)
     */
    this.state = {
      configurationString: this.props.navigation.getParam('configurationString', ''),
      errorMessage: '',
      token: null,
    };
  }

  componentDidMount = () => {
    // Check if passed configuration string is valid
    this.validateConfigurationString();
  }

  onConfigStringChange = (text) => {
    this.setState({ configurationString: text, errorMessage: '', token: null }, () => {
      this.validateConfigurationString();
    });
  }

  validateConfigurationString = () => {
    if (this.state.configurationString === '') {
      return;
    }

    const result = hathorLib.tokens.validateTokenToAddByConfigurationString(this.state.configurationString);
    if (result.success) {
      this.setState({ token: result.tokenData, errorMessage: '' });
    } else {
      this.setState({ errorMessage: result.message });
    }
  }

  onButtonPress = () => {
    const { token } = this.state;
    hathorLib.tokens.addToken(token.uid, token.name, token.symbol);
    this.props.dispatch(newToken(token));
    this.props.dispatch(updateSelectedToken(token));
    this.props.navigation.dismiss();
  }

  render() {
    const renderTokenView = () => {
      const styles = StyleSheet.create({
        text: {
          fontSize: 14,
          lineHeight: 24,
          color: 'rgba(0, 0, 0, 0.5)',
        },
        wrapper: {
          marginVertical: 16,
          padding: 16,
          backgroundColor: '#f7f7f7',
          borderRadius: 8,
        },
      });

      return (
        <View style={styles.wrapper}>
          <Text style={styles.text}>You're going to register the following token:</Text>
          <Text style={styles.text}>
            <Strong>Name: </Strong>
            {this.state.token.name}
          </Text>
          <Text style={styles.text}>
            <Strong>Symbol: </Strong>
            {this.state.token.symbol}
          </Text>
        </View>
      );
    };

    return (
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}>
          <HathorHeader
            withBorder
            title="REGISTER TOKEN"
            onBackPress={() => this.props.navigation.goBack()}
          />
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View>
              <SimpleInput
                label="Configuration string"
                autoFocus
                multiline
                onChangeText={this.onConfigStringChange}
                error={this.state.errorMessage}
                value={this.state.configurationString}
                returnKeyType="done"
                enablesReturnKeyAutomatically
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {this.state.token && renderTokenView()}
            </View>
            <NewHathorButton
              title="Register token"
              disabled={this.state.configurationString === '' || this.state.errorMessage !== ''}
              onPress={this.onButtonPress}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}

export default connect(null)(RegisterTokenManual);
