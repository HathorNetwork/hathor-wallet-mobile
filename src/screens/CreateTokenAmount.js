/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { KeyboardAvoidingView, SafeAreaView, Text, View } from 'react-native';
import { connect } from 'react-redux';
import { t, jt } from 'ttag';

import hathorLib from '@hathor/wallet-lib';
import AmountTextInput from '../components/AmountTextInput';
import HathorHeader from '../components/HathorHeader';
import InfoBox from '../components/InfoBox';
import InputLabel from '../components/InputLabel';
import NewHathorButton from '../components/NewHathorButton';
import OfflineBar from '../components/OfflineBar';
import { getIntegerAmount, getKeyboardAvoidingViewTopDistance, Strong } from '../utils';


/**
 * balance {Object} object with token balance {'available', 'locked'}
 */
const mapStateToProps = (state) => ({
  balance: (state.tokensBalance[hathorLib.constants.HATHOR_TOKEN_CONFIG.uid]
            || { available: 0, locked: 0 }),
});

/**
 * This screen expect the following parameters on the navigation:
 * name {string} token name
 * symbol {string} token symbol
 */
class CreateTokenAmount extends React.Component {
  /**
   * amount {string} amount of tokens to create
   * deposit {number} HTR deposit required for creating the amount
   */
  state = {
    amount: '',
    deposit: 0,
  };

  constructor(props) {
    super(props);
    this.inputRef = React.createRef();
    this.willFocusEvent = null;
    this.name = this.props.navigation.getParam('name');
    this.symbol = this.props.navigation.getParam('symbol');
  }

  componentDidMount() {
    this.willFocusEvent = this.props.navigation.addListener('willFocus', () => {
      this.focusInput();
    });
  }

  componentWillUnmount() {
    this.willFocusEvent.remove();
  }

  focusInput = () => {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

  onAmountChange = (text) => {
    const amount = getIntegerAmount(text);
    const deposit = (amount ? hathorLib.helpers.getDepositAmount(amount) : 0);
    this.setState({ amount: text, deposit });
  }

  onButtonPress = () => {
    const amount = getIntegerAmount(this.state.amount);
    this.props.navigation.navigate('CreateTokenConfirm', { name: this.name, symbol: this.symbol, amount });
  }

  isButtonDisabled = () => {
    if (this.state.amount === '') {
      return true;
    }

    if (getIntegerAmount(this.state.amount) === 0) {
      return true;
    }

    // disabled if we don't have required deposit
    if (this.state.deposit > this.props.balance.available) {
      return true;
    }

    return false;
  }

  render() {
    const amountStyle = (this.state.deposit > this.props.balance.available ? { color: 'red' } : {});
    const amountAvailableText = (
      <Strong style={amountStyle}>
        {hathorLib.helpers.prettyValue(this.props.balance.available)} HTR
      </Strong>
    );

    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title={t`CREATE TOKEN`}
          onBackPress={() => this.props.navigation.goBack()}
          onCancel={() => this.props.navigation.dismiss()}
        />
        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View style={{ marginTop: 24 }}>
              <InputLabel style={{ textAlign: 'center', marginBottom: 16 }}>
                {t`Amount of ${this.name} (${this.symbol})`}
              </InputLabel>
              <AmountTextInput
                ref={this.inputRef}
                autoFocus
                onAmountUpdate={this.onAmountChange}
                value={this.state.amount}
              />
            </View>
            <View>
              <InfoBox
                items={[
                  <Text>{t`Deposit:`} <Strong style={amountStyle}>
                    {hathorLib.helpers.prettyValue(this.state.deposit)} HTR
                  </Strong></Text>,
                  <Text>
                    {jt`You have ${amountAvailableText} HTR available`}
                  </Text>
                ]}
              />
              <NewHathorButton
                title={t`Next`}
                disabled={this.isButtonDisabled()}
                onPress={this.onButtonPress}
              />
            </View>
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}

export default connect(mapStateToProps)(CreateTokenAmount);
