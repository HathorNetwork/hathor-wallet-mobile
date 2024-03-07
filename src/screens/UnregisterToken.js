/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Switch,
} from 'react-native';
import { t } from 'ttag';

import { connect } from 'react-redux';
import hathorLib from '@hathor/wallet-lib';
import { setTokens, tokenMetadataRemoved } from '../actions';
import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import TextFmt from '../components/TextFmt';
import baseStyle from '../styles/init';
import { getTokenLabel } from '../utils';
import { COLORS } from '../styles/themes';
import NavigationService from '../NavigationService';

/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 */
const mapStateToProps = (state) => ({
  storage: state.wallet.storage,
  selectedToken: state.selectedToken,
});

class UnregisterToken extends React.Component {
  style = ({ ...baseStyle,
    ...StyleSheet.create({
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
      textError: {
        marginTop: 32,
        marginBottom: 32,
        color: COLORS.errorBgColor,
      },
    }) });

  /**
   * switchValue {bool} If user confirms that want to unregister the token
   * errorMessage {string} Error message to be shown in case of failure when unregistering the token
   */
  state = {
    switchValue: false,
    errorMessage: '',
  };

  toggleSwitch = (value) => {
    this.setState({ switchValue: value });
  }

  unregisterConfirmed = () => {
    const tokenUnregister = this.props.selectedToken.uid;
    // Preventing unregistering HTR token, even if the user gets on this screen because of an error
    if (tokenUnregister === hathorLib.constants.HATHOR_TOKEN_CONFIG.uid) {
      return;
    }

    // XXX: maybe we should create a new action `removeToken`
    // so we dont need to get all registered tokens to call setTokens
    const promise = this.props.storage.unregisterToken(tokenUnregister).then(async () => {
      const newTokens = {};

      const iterator = this.props.storage.getRegisteredTokens();
      let next = await iterator.next();
      // XXX: The "for await" syntax wouldbe better but this is failing due to
      // redux-saga messing with the for operator runtime
      while (!next.done) {
        const token = next.value;
        // We need to filter the token data to remove the metadata from this list (e.g. balance)
        newTokens[token.uid] = { ...token };
        // eslint-disable-next-line no-await-in-loop
        next = await iterator.next();
      }
      return newTokens;
    });
    promise.then((tokens) => {
      this.props.dispatch(tokenMetadataRemoved(tokenUnregister));
      this.props.dispatch(setTokens(tokens));
      NavigationService.resetToMain();
    }, (e) => {
      this.setState({ errorMessage: e.message });
    });
  }

  render() {
    const tokenLabel = getTokenLabel(this.props.selectedToken);
    return (
      <View style={{ flex: 1 }}>
        <HathorHeader
          title={t`UNREGISTER TOKEN`}
          onBackPress={() => this.props.navigation.goBack()}
        />
        <View style={this.style.container}>
          <TextFmt style={this.style.text}>
            {t`If you unregister this token **you won't be able to execute operations with it**, unless you register it again.`}
          </TextFmt>
          <Text style={this.style.text}>
            {t`You won't lose your tokens, they will just not appear on this wallet anymore.`}
          </Text>
          <View style={this.style.switchView}>
            <TextFmt style={this.style.switchText}>
              {t`I want to unregister the token **${tokenLabel}**`}
            </TextFmt>
            <Switch
              onValueChange={this.toggleSwitch}
              trackColor={{ true: COLORS.primary }}
              value={this.state.switchValue}
            />
          </View>
          <Text style={this.style.textError}>{this.state.errorMessage}</Text>
          <View style={this.style.buttonView}>
            <NewHathorButton
              secondary
              color={COLORS.primary}
              disabled={!this.state.switchValue}
              onPress={this.unregisterConfirmed}
              title={t`Unregister token`}
            />
          </View>
        </View>
      </View>
    );
  }
}

export default connect(mapStateToProps)(UnregisterToken);
