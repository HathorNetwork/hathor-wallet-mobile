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

import { connect } from 'react-redux';
import hathorLib from '@hathor/wallet-lib';
import { setTokens } from '../actions';
import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import baseStyle from '../styles/init';
import { Strong, getTokenLabel } from '../utils';


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 */
const mapStateToProps = (state) => ({
  selectedToken: state.selectedToken,
});


class UnregisterToken extends React.Component {
  style = Object.assign({}, baseStyle, StyleSheet.create({
    switchView: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    switchText: {
      paddingRight: 16,
      fontSize: 18,
      lineHeight: 28,
      flex: 1,
    },
  }));

  /**
   * switchValue {bool} If user confirms that want to unregister the token
   */
  state = {
    switchValue: false,
  };

  toggleSwitch = (value) => {
    this.setState({ switchValue: value });
  }

  unregisterConfirmed = () => {
    // Preventing unregistering HTR token, even if the user gets on this screen because of an error
    if (this.props.selectedToken.uid === hathorLib.constants.HATHOR_TOKEN_CONFIG.uid) {
      return;
    }

    const tokens = hathorLib.tokens.unregisterToken(this.props.selectedToken.uid);
    this.props.dispatch(setTokens(tokens));
    this.props.navigation.navigate('Dashboard');
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title='UNREGISTER TOKEN'
          onBackPress={() => this.props.navigation.goBack()}
        />
        <View style={this.style.container}>
          <Text style={this.style.text}>
            If you unregister this token
            {' '}
            <Strong>you won&apos;t be able to execute operations with it</Strong>
            , unless you register it again.
          </Text>
          <Text style={this.style.text}>
            You won&apos;t lose your tokens, they will just not appear on this wallet anymore.
          </Text>
          <View style={this.style.switchView}>
            <Text style={this.style.switchText}>
              I want to unregister the token
              {' '}
              <Strong>{getTokenLabel(this.props.selectedToken)}</Strong>
            </Text>
            <Switch
              onValueChange={this.toggleSwitch}
              trackColor={{ true: '#E30052' }}
              value={this.state.switchValue}
            />
          </View>
          <View style={this.style.buttonView}>
            <NewHathorButton
              secondary
              color='#E30052'
              disabled={!this.state.switchValue}
              onPress={this.unregisterConfirmed}
              title='Unregister token'
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

export default connect(mapStateToProps)(UnregisterToken);
