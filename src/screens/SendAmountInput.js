import React from 'react';
import {
  KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { connect } from 'react-redux';
import { getStatusBarHeight } from 'react-native-status-bar-height';

import hathorLib from '@hathor/wallet-lib';
import NewHathorButton from '../components/NewHathorButton';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import TokenBox from '../components/TokenBox';
import HathorHeader from '../components/HathorHeader';
import { getIntegerAmount } from '../utils';
import OfflineBar from '../components/OfflineBar';


/**
 * tokens {Object} array with all added tokens on this wallet
 * selectedToken {Object} token currently selected by the user
 * tokensBalance {Object} dict with balance for each token
 */
const mapStateToProps = state => ({
  tokens: state.tokens,
  selectedToken: state.selectedToken,
  tokensBalance: state.tokensBalance,
});

class SendAmountInput extends React.Component {
  /**
   * amount {string} amount to send
   * token {Object} which token to send
   * error {string} error validating amount
   */
  state = {
    amount: '',
    token: this.props.selectedToken,
    error: null,
  };

  inputRef = React.createRef();

  willFocusEvent = null;

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
    this.setState({ amount: text, error: null });
  }

  onTokenChange = (token) => {
    this.setState({ token });
  }

  onTokenBoxPress = () => {
    this.props.navigation.navigate(
      'ChangeToken',
      {
        token: this.state.token,
        onItemPress: (item) => {
          this.onTokenChange(item);
        },
      },
    );
  }

  onButtonPress = () => {
    const balance = this.props.tokensBalance[this.state.token.uid];
    const available = balance ? balance.available : 0;
    const amount = getIntegerAmount(this.state.amount);
    if (available < amount) {
      this.setState({ error: 'Insufficient funds' });
    } else {
      // forward the address we got from the last screen to the next one
      const address = this.props.navigation.getParam('address');
      this.props.navigation.navigate('SendConfirmScreen', { address, amount, token: this.state.token });
    }
  }

  isButtonDisabled = () => {
    if (this.state.amount === '') {
      return true;
    }
    if (getIntegerAmount(this.state.amount) === 0) {
      return true;
    }
    return false;
  }

  render() {
    const getAvailableString = () => {
      // eg: '23.56 HTR available'
      const balance = this.props.tokensBalance[this.state.token.uid];
      const available = balance ? balance.available : 0;
      return `${hathorLib.helpers.prettyValue(available)} ${this.state.token.symbol} available`;
    };

    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title={`SEND ${this.state.token.name.toUpperCase()}`}
          onBackPress={() => this.props.navigation.goBack()}
        />
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={getStatusBarHeight()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View>
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 40,
              }}
              >
                <View style={{ width: 80, height: 40 }} />
                <AmountTextInput
                  ref={this.inputRef}
                  autoFocus
                  onAmountUpdate={this.onAmountChange}
                  value={this.state.amount}
                />
                <View style={{
                  alignItems: 'center', justifyContent: 'center', height: 40, width: 80, borderWidth: 1, borderColor: '#000', borderRadius: 8,
                }}
                >
                  <TokenBox
                    onPress={this.onTokenBoxPress}
                    label={this.state.token.symbol}
                  />
                </View>
              </View>
              <InputLabel style={{ textAlign: 'center', marginTop: 8 }}>
                {getAvailableString()}
              </InputLabel>
              <Text style={styles.error}>{this.state.error}</Text>
            </View>
            <NewHathorButton
              title="Next"
              disabled={this.isButtonDisabled()}
              onPress={this.onButtonPress}
            />
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  error: {
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
    // TODO define better color. Maybe also change underline color to red?
    color: 'red',
  },
});

export default connect(mapStateToProps)(SendAmountInput);
