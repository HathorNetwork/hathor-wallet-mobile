/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  SafeAreaView,
  Text,
  View,
  Switch,
} from 'react-native';

import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import baseStyle from '../styles/init';
import { Strong, resetWallet } from '../utils';
import { HATHOR_COLOR } from '../constants';


export class ResetWallet extends React.Component {
  style = Object.assign({}, baseStyle, StyleSheet.create({
    switchView: {
      flexDirection: 'row',
    },
    switchText: {
      paddingLeft: 16,
      fontSize: 14,
      lineHeight: 18,
      flex: 1,
    },
  }));

  /**
   * switchValue {bool}
   *   Indicates whether user wants to reset his/her wallet. It enables the Reset Wallet button.
   * */
  state = {
    switchValue: false,
  };

  constructor(props) {
    super(props);
    this.onBackPress = this.props.navigation.getParam('onBackPress', this.props.navigation.goBack);
  }

  toggleSwitch = (value) => {
    this.setState({ switchValue: value });
  }

  onPressResetWallet = () => {
    resetWallet(this.props.navigation);
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title='RESET WALLET'
          onBackPress={() => this.onBackPress()}
        />
        <View style={this.style.container}>
          <Text style={this.style.title}>Are you sure?</Text>
          <Text style={this.style.text}>
            If you reset your wallet, <Strong>all data will be deleted</Strong>, and you will{' '}
            <Strong>lose access to your tokens</Strong>. To recover access to your tokens, you will
            {' '}need to import your seed words again.
          </Text>
          <View style={this.style.switchView}>
            <Switch
              onValueChange={this.toggleSwitch}
              trackColor={{ true: HATHOR_COLOR }}
              value={this.state.switchValue}
            />
            <Text style={this.style.switchText}>
              I want to reset my wallet, and I acknowledge that
              <Strong>all data will be wiped out</Strong>.
            </Text>
          </View>
          <View style={this.style.buttonView}>
            <NewHathorButton
              secondary
              color={HATHOR_COLOR}
              disabled={!this.state.switchValue}
              onPress={this.onPressResetWallet}
              title='Reset Wallet'
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

export default ResetWallet;
