/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { connect } from 'react-redux';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { t, ngettext, msgid } from 'ttag';
import { get } from 'lodash';
import { bigIntCoercibleSchema } from '@hathor/wallet-lib/lib/utils/bigint';

import { IS_MULTI_TOKEN } from '../constants';
import { renderValue, isTokenNFT } from '../utils';
import NewHathorButton from '../components/NewHathorButton';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import TokenBox from '../components/TokenBox';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';
import { COLORS } from '../styles/themes';

/**
 * tokens {Object} array with all added tokens on this wallet
 * selectedToken {Object} token currently selected by the user
 * tokensBalance {Object} dict with balance for each token
 * tokenMetadata {Object} metadata of tokens
 */
const mapStateToProps = (state) => ({
  tokens: state.tokens,
  selectedToken: state.selectedToken,
  tokensBalance: state.tokensBalance,
  tokenMetadata: state.tokenMetadata,
});

class SendAmountInput extends React.Component {
  /**
   * amount {string} amount to send as text representation
   * amountValue {BigInt} amount to send as BigInt value
   * token {Object} which token to send
   * error {string} error validating amount
   */
  state = {
    amount: '',
    amountValue: null,
    token: this.props.selectedToken,
    error: null,
  };

  inputRef = React.createRef();

  focusEvent = null;

  componentDidMount() {
    this.focusEvent = this.props.navigation.addListener('focus', () => {
      this.focusInput();
    });
  }

  componentWillUnmount() {
    this.focusEvent();
  }

  componentDidUpdate(prevProps) {
    // Sync local state with the updated selected token, if it has changed
    if (prevProps.selectedToken !== this.props.selectedToken) {
      this.setState({ token: this.props.selectedToken });
    }
  }

  focusInput = () => {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

  onAmountChange = (text, value) => {
    this.setState({ amount: text, amountValue: value, error: null });
  }

  onTokenBoxPress = () => {
    // We will be informed of any token change by the redux `selectedToken` state
    this.props.navigation.navigate('ChangeToken', { token: this.state.token });
  }

  onButtonPress = () => {
    const balance = get(this.props.tokensBalance, this.state.token.uid, {
      data: {
        available: 0,
        locked: 0,
      },
      status: TOKEN_DOWNLOAD_STATUS.LOADING,
    });
    const { available } = balance.data;

    // Use amountValue from state
    const amount = this.state.amountValue;

    if (!amount) {
      this.setState({ error: t`Invalid amount` });
      return;
    }

    if (available < amount) {
      this.setState({ error: t`Insufficient funds` });
    } else {
      // forward the address we got from the last screen to the next one
      const { address } = this.props.route.params;
      this.props.navigation.navigate('SendConfirmScreen', { address, amount, token: this.state.token });
    }
  }

  isButtonDisabled = () => (
    !this.state.amount
    || !this.state.amountValue
    || this.state.amountValue === 0n
  );

  isNFT = () => (
    isTokenNFT(get(this.state, 'token.uid'), this.props.tokenMetadata)
  )

  render() {
    const getAvailableString = () => {
      // eg: '23.56 HTR available'
      const balance = get(this.props.tokensBalance, `${this.state.token.uid}.data`, {
        available: 0,
        locked: 0,
      });
      const { available } = balance;
      const amountAndToken = `${renderValue(available, this.isNFT())} ${this.state.token.symbol}`;
      // Convert BigInt to Number for ngettext - extract as variable for ttag compatibility
      // This is only used for pluralization so precision loss is acceptable
      const availableCount = Number(available);
      return ngettext(msgid`${amountAndToken} available`, `${amountAndToken} available`, availableCount);
    };

    const renderGhostElement = () => (
      <View style={{ width: 80, height: 40 }} />
    );

    const tokenNameUpperCase = this.state.token.name.toUpperCase();
    return (
      <View style={{ flex: 1 }}>
        <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()}>
          <HathorHeader
            withBorder
            title={t`SEND ${tokenNameUpperCase}`}
            onBackPress={() => this.props.navigation.goBack()}
          />
          <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getStatusBarHeight()}>
            <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
              <View>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 40,
                }}
                >
                  {renderGhostElement()}
                  <AmountTextInput
                    ref={this.inputRef}
                    autoFocus
                    onAmountUpdate={this.onAmountChange}
                    value={this.state.amount}
                    allowOnlyInteger={this.isNFT()}
                    style={{ flex: 1 }} // we need this so the placeholder doesn't break in android
                                        // devices after erasing the text
                                        // https://github.com/facebook/react-native/issues/30666
                  />
                  {IS_MULTI_TOKEN
                    ? <TokenBox onPress={this.onTokenBoxPress} label={this.state.token.symbol} />
                    : renderGhostElement()}
                </View>
                <InputLabel style={{ textAlign: 'center', marginTop: 8 }}>
                  {getAvailableString()}
                </InputLabel>
                <Text style={styles.error}>{this.state.error}</Text>
              </View>
              <NewHathorButton
                title={t`Next`}
                disabled={this.isButtonDisabled()}
                onPress={this.onButtonPress}
              />
            </View>
            <OfflineBar style={{ position: 'relative' }} />
          </KeyboardAvoidingView>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  error: {
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
    // TODO Maybe also change underline color to red?
    color: COLORS.errorTextColor,
  },
});

export default connect(mapStateToProps)(SendAmountInput);
