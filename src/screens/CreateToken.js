/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  SafeAreaView,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';

import hathorLib from '@hathor/wallet-lib';
import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import AmountTextInput from '../components/AmountTextInput';

import { getIntegerAmount } from '../utils';
import { newToken, updateSelectedToken } from '../actions';


class CreateToken extends React.Component {
  /**
   * name {string} Input value for token name
   * symbol {string} Input value for token symbol
   * amount {string} Input value for token amount
   * errorMessage {string} Error message to be shown in case of failure when creating new token
   * loading {boolean} If should show spinner loading
   */
  state = {
    name: '',
    symbol: '',
    amount: '',
    errorMessage: '',
    loading: false,
  };

  style = StyleSheet.create({
    view: {
      padding: 16,
    },
    textError: {
      marginTop: 32,
      marginBottom: 32,
      color: '#dc3545',
    },
  });

  getData = () => {
    const walletData = hathorLib.wallet.getWalletData();
    if (walletData === null) {
      return null;
    }
    const historyTransactions = 'historyTransactions' in walletData ? walletData.historyTransactions : {};
    const inputsData = hathorLib.wallet.getInputsFromAmount(
      historyTransactions,
      hathorLib.helpers.minimumAmount(),
      hathorLib.constants.HATHOR_TOKEN_CONFIG.uid,
    );
    if (inputsData.inputs.length === 0) {
      this.setState({ errorMessage: t`You don't have any hathor tokens available to create your token.` });
      return null;
    }

    const input = inputsData.inputs[0];
    const amount = inputsData.inputsAmount;
    const outputChange = hathorLib.wallet.getOutputChange(
      amount,
      hathorLib.constants.HATHOR_TOKEN_INDEX
    );
    return { input, output: outputChange };
  }

  validateAndAdd = () => {
    if (!this.state.name || !this.state.symbol || !this.state.amount) {
      this.setState({ errorMessage: t`All fields must be filled.` });
      return;
    }
    this.askPIN();
  }

  createToken = (pin) => {
    const data = this.getData();
    if (data === null) {
      return;
    }
    this.setState({ errorMessage: '', loading: true });
    const address = hathorLib.wallet.getAddressToUse();
    const value = getIntegerAmount(this.state.amount);
    const retPromise = hathorLib.tokens.createToken(
      data.input,
      data.output,
      address,
      this.state.name,
      this.state.symbol,
      value,
      pin
    );
    retPromise.then((token) => {
      this.props.dispatch(newToken(token));
      this.props.dispatch(updateSelectedToken(token));
      this.props.navigation.navigate('Home');
      this.setState({ loading: false });
    }, (message) => {
      this.setState({ errorMessage: message, loading: false });
    });
  }

  askPIN = () => {
    this.props.navigation.navigate(
      'PinScreen',
      {
        cb: this.createToken,
        screenText: t`Enter your 6-digit pin to create your token`,
        biometryText: t`Authorize token creation`,
        canCancel: true,
      },
    );
  }

  onChangeText = (field, value) => {
    this.setState({ [field]: value });
  }

  render() {
    return (
      <SafeAreaView>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View>
            <HathorHeader
              title={t`CREATE NEW TOKEN`}
              onBackPress={() => this.props.navigation.goBack()}
              wrapperStyle={{ borderBottomWidth: 0 }}
            />
            <View style={this.style.view}>
              <SimpleInput
                label={t`Token Name`}
                maxLength={50}
                onChangeText={(text) => this.onChangeText('name', text)}
                value={this.state.name}
                containerStyle={{ marginBottom: 16 }}
              />
              <SimpleInput
                label={t`Token Symbol`}
                maxLength={5}
                onChangeText={(text) => this.onChangeText('symbol', text)}
                value={this.state.symbol}
                containerStyle={{ marginBottom: 16 }}
                autoCapitalize='characters'
              />
              <SimpleInput
                label={t`Amount`}
                input={(
                  <AmountTextInput
                    onAmountUpdate={(amount) => this.setState({ amount })}
                    textAlign='left'
                    value={this.state.amount}
                  />
)}
              />
              <Text style={this.style.textError}>{this.state.errorMessage}</Text>
              <NewHathorButton
                title={t`Create New Token`}
                onPress={this.validateAndAdd}
                disabled={this.state.loading}
              />
              {this.state.loading && <ActivityIndicator style={{ marginTop: 16 }} size='large' animating />}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    );
  }
}

export default connect(null)(CreateToken);
