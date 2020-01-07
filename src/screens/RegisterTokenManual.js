/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Keyboard, KeyboardAvoidingView, SafeAreaView, Text, View,
} from 'react-native';
import { t } from 'ttag';

import { connect } from 'react-redux';
import hathorLib from '@hathor/wallet-lib';
import HathorHeader from '../components/HathorHeader';
import InfoBox from '../components/InfoBox';
import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import Spinner from '../components/Spinner';

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
     * configString {string} The value of the configuration string input
     * errorMessage {string} Error with the configuration string
     * token {Object} Config of the token from the configuration string (if valid)
     * validating {boolean} If is running validation method for configuration string
     */
    this.state = {
      configString: this.props.navigation.getParam('configurationString', ''),
      errorMessage: '',
      token: null,
      validating: false,
    };
  }

  componentDidMount = () => {
    // Check if passed configuration string is valid
    this.validateConfigurationString();
  }

  onConfigStringChange = (text) => {
    this.setState({ configString: text, errorMessage: '', token: null }, () => {
      this.validateConfigurationString();
    });
  }

  validateConfigurationString = () => {
    if (this.state.configString === '') {
      return;
    }

    this.setState({ validating: true }, () => {
      const promise = hathorLib.tokens.validateTokenToAddByConfigurationString(
        this.state.configString
      );
      promise.then((tokenData) => {
        this.setState({ token: tokenData, errorMessage: '', validating: false });
      }, (e) => {
        this.setState({ errorMessage: e.message, validating: false });
      });
    });
  }

  onButtonPress = () => {
    const { token } = this.state;
    hathorLib.tokens.addToken(token.uid, token.name, token.symbol);
    this.props.dispatch(newToken(token));
    this.props.dispatch(updateSelectedToken(token));
    this.props.navigation.dismiss();
  }

  render() {
    const renderTokenView = () => (
      <InfoBox
        items={[
          <Text>{t`You're going to register the following token:`}</Text>,
          <Text>
            <Strong>{t`Name: `}</Strong>
            {this.state.token.name}
          </Text>,
          <Text>
            <Strong>{t`Symbol: `}</Strong>
            {this.state.token.symbol}
          </Text>
        ]}
      />
    );

    const renderSpinner = () => (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={32} animating />
      </View>
    );

    return (
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}>
          <HathorHeader
            withBorder
            title={t`REGISTER TOKEN`}
            onBackPress={() => this.props.navigation.goBack()}
          />
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View>
              <SimpleInput
                label={t`Configuration string`}
                autoFocus
                multiline
                onChangeText={this.onConfigStringChange}
                error={this.state.errorMessage}
                value={this.state.configString}
                returnKeyType='done'
                enablesReturnKeyAutomatically
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {this.state.token && renderTokenView()}
            </View>
            {this.state.validating && renderSpinner()}
            <NewHathorButton
              title={t`Register token`}
              disabled={this.state.configString === '' || this.state.errorMessage !== '' || this.state.token === null}
              onPress={this.onButtonPress}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}

export default connect(null)(RegisterTokenManual);
