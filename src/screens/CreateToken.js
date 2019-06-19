import React from 'react';
import { NavigationActions } from 'react-navigation';
import { ActivityIndicator, Keyboard, SafeAreaView, Text, TouchableWithoutFeedback, View } from 'react-native';
import { connect } from 'react-redux';

import ModalTop from '../components/ModalTop';
import HathorButton from '../components/HathorButton';
import HathorTextInput from '../components/HathorTextInput';

import { getAmountParsed, getNoDecimalsAmount } from '../utils';
import { newToken, updateSelectedToken } from '../actions';

import hathorLib from '@hathor/wallet-lib';


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
  }

  getData = () => {
    const walletData = hathorLib.wallet.getWalletData();
    if (walletData === null) {
      return null;
    }
    const historyTransactions = 'historyTransactions' in walletData ? walletData.historyTransactions : {};
    const inputsData = hathorLib.wallet.getInputsFromAmount(historyTransactions, hathorLib.helpers.minimumAmount(), hathorLib.constants.HATHOR_TOKEN_CONFIG.uid);
    if (inputsData.inputs.length === 0) {
      this.setState({ errorMessage: 'You don\'t have any hathor tokens available to create your token.' });
      return null;
    }

    const input = inputsData.inputs[0];
    const amount = inputsData.inputsAmount;
    const outputChange = hathorLib.wallet.getOutputChange(amount, hathorLib.constants.HATHOR_TOKEN_INDEX);
    return {'input': input, 'output': outputChange};
  }

  validateAndAdd = () => {
    if (!this.state.name || !this.state.symbol || !this.state.amount) {
      this.setState({ errorMessage: 'All fields are required.' });
      return;
    }
    this.createToken();
  }

  createToken = () => {
    const data = this.getData();
    if (data === null) {
      return;
    }
    this.setState({ errorMessage: '', loading: true });
    const address = hathorLib.wallet.getAddressToUse();
    // TODO ask for PIN
    const value = getNoDecimalsAmount(parseFloat(this.state.amount.replace(',', '.')));
    const retPromise = hathorLib.tokens.createToken(data.input, data.output, address, this.state.name, this.state.symbol, value, '123456');
    retPromise.then((token) => {
      this.props.dispatch(newToken(token));
      this.props.dispatch(updateSelectedToken(token));
      this.props.navigation.navigate('Home');
      this.setState({ loading: false });
    }, (message) => {
      this.setState({ errorMessage: message, loading: false });
    });
  }

  render() {
    const getContent = () => {
      return (
        <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 24 }}>
          <HathorTextInput
            style={{ width: 320, height: 32 }}
            placeholder="Token name"
            blurOnSubmit={true}
            returnKeyType="done"
            clearButtonMode="while-editing"
            onChangeText={(text) => this.setState({name: text})}
            value={this.state.name} />
          <HathorTextInput
            style={{ width: 320, marginTop: 24, height: 32 }}
            placeholder="Symbol (max 5 characters)"
            blurOnSubmit={true}
            returnKeyType="done"
            maxLength={5}
            clearButtonMode="while-editing"
            onChangeText={(text) => this.setState({symbol: text})}
            value={this.state.symbol} />
          <HathorTextInput
            style={{ width: 320, marginTop: 24, height: 32 }}
            blurOnSubmit={true}
            returnKeyType="done"
            placeholder="0.00"
            keyboardType="numeric"
            clearButtonMode="while-editing"
            onChangeText={(text) => this.setState({amount: getAmountParsed(text)})}
            value={this.state.amount} />
          <HathorButton 
            style={{ marginVertical: 16 }}
            onPress={() => this.validateAndAdd()}
            title="Create token"
            disabled={this.state.loading} />
          <Text style={{ color: '#dc3545' }}>{this.state.errorMessage}</Text>
          <ActivityIndicator size="large" animating={this.state.loading} />
        </View>
      )
    }

    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, justifyContent: "flex-start", alignItems: "center" }}>
            <ModalTop title='Create token' navigation={this.props.navigation} />
            {getContent()}
          </View>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    );
  }
}

export default connect(null)(CreateToken);
