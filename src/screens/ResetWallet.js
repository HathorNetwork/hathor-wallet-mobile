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
import { t } from 'ttag';

import * as Keychain from 'react-native-keychain';
import hathorLib from '@hathor/wallet-lib';
import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import TextFmt from '../components/TextFmt';
import baseStyle from '../styles/init';
import { PRIMARY_COLOR } from '../constants';
import { connect } from 'react-redux';
import { resetWallet } from '../actions';

const mapDispatchToProps = (dispatch) => ({
  resetWallet: () => dispatch(resetWallet()),
});


class ResetWallet extends React.Component {
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

  onPressResetWallet = async () => {
    this.props.resetWallet();
    await Keychain.resetGenericPassword();
    this.props.navigation.navigate('Init');
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title={t`RESET WALLET`}
          onBackPress={() => this.onBackPress()}
        />
        <View style={this.style.container}>
          <Text style={this.style.title}>{t`Are you sure?`}</Text>
          <Text style={this.style.text}>
            <TextFmt>
              {t`If you reset your wallet, **all data will be deleted**, and you will **lose access to your tokens**.`}
            </TextFmt>
            {' '}{t`To recover access to your tokens, you will need to import your seed words again.`}
          </Text>
          <View style={this.style.switchView}>
            <Switch
              onValueChange={this.toggleSwitch}
              trackColor={{ true: PRIMARY_COLOR }}
              value={this.state.switchValue}
            />
            <TextFmt style={this.style.switchText}>
              {t`I want to reset my wallet, and I acknowledge that **all data will be wiped out**.`}
            </TextFmt>
          </View>
          <View style={this.style.buttonView}>
            <NewHathorButton
              secondary
              color={PRIMARY_COLOR}
              disabled={!this.state.switchValue}
              onPress={this.onPressResetWallet}
              title={t`Reset Wallet`}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

export default connect(null, mapDispatchToProps)(ResetWallet);
