/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Dimensions, KeyboardAvoidingView, StyleSheet, View,
} from 'react-native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { connect } from 'react-redux';
import { t } from 'ttag';
import { get } from 'lodash';

import { IS_MULTI_TOKEN } from '../constants';
import NewHathorButton from './NewHathorButton';
import AmountTextInput from './AmountTextInput';
import TokenBox from './TokenBox';
import { newInvoice } from '../actions';
import { getIntegerAmount, isTokenNFT } from '../utils';
import OfflineBar from './OfflineBar';


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 * tokenMetadata {Object} metadata of tokens
 */
const mapStateToProps = (state) => ({
  selectedToken: state.selectedToken,
  wallet: state.wallet,
  tokenMetadata: state.tokenMetadata,
});

class NewPaymentRequest extends React.Component {
  constructor(props) {
    super(props);

    /**
     * amount {string} Amount for the payment request
     * token {Object} Selected token config
     */
    this.state = {
      amount: '',
      token: this.props.selectedToken,
    };

    // If the payment request detail modal was opened
    this.modalOpened = false;
    this.willFocusEvent = null;
    this.inputRef = React.createRef();
  }

  componentDidMount() {
    const { navigation } = this.props;
    this.willFocusEvent = navigation.addListener('willFocus', () => {
      if (this.modalOpened) {
        // It's coming back
        this.modalOpened = false;
        this.focusInput();
      } else if (this.props.index === 1) {
        // We have to focus the input only if we are on this tab
        this.focus();
      }
    });
  }

  componentWillUnmount() {
    this.willFocusEvent.remove();
  }

  focus = () => {
    this.setState({ amount: '', token: this.props.selectedToken });
    this.focusInput();
  }

  focusInput = () => {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

  onTokenChange = (token) => {
    this.setState({ token });
  }

  getTokenUID = () => (
    get(this.state, 'token.uid')
  )

  createPaymentRequest = async () => {
    const { address } = await this.props.wallet.getCurrentAddress();
    let amount;
    if (isTokenNFT(this.getTokenUID(), this.props.tokenMetadata)) {
      amount = parseInt(this.state.amount, 10);
    } else {
      amount = getIntegerAmount(this.state.amount);
    }
    this.props.dispatch(newInvoice(address, amount, this.state.token));
    this.modalOpened = true;
    this.props.navigation.navigate('PaymentRequestDetail');
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

  onTokenBoxPress = () => {
    this.modalOpened = true;
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

  render() {
    // Status bar + header + tab height
    const topDistance = getStatusBarHeight() + 56 + 48;

    const { height } = Dimensions.get('window');

    // For small devices the button was hidden
    const inputMargin = height > 650 ? 64 : 32;

    const buttonWrapperStyle = StyleSheet.create({
      style: {
        marginHorizontal: 16,
        marginBottom: 16,
        marginTop: inputMargin,
        flex: 1,
        justifyContent: 'flex-end',
        alignSelf: 'stretch',
      },
    });

    const renderGhostElement = () => (
      <View style={{ width: 80, height: 40 }} />
    );

    return (
      <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={topDistance}>
        <View style={{
          flex: 1, alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 16,
        }}
        >
          <View style={{
            alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, marginTop: inputMargin,
          }}
          >
            {renderGhostElement()}
            <AmountTextInput
              ref={this.inputRef}
              onAmountUpdate={(amount) => this.setState({ amount })}
              value={this.state.amount}
              style={{ flex: 1 }}
              allowOnlyInteger={isTokenNFT(this.getTokenUID(), this.props.tokenMetadata)}
            />
            {IS_MULTI_TOKEN
              ? <TokenBox onPress={this.onTokenBoxPress} label={this.state.token.symbol} />
              : renderGhostElement()
            }
          </View>
          <View style={buttonWrapperStyle.style}>
            <NewHathorButton
              disabled={this.isButtonDisabled()}
              title={t`Create payment request`}
              onPress={this.createPaymentRequest}
            />
          </View>
        </View>
        <OfflineBar style={{ position: 'relative' }} />
      </KeyboardAvoidingView>
    );
  }
}

export default connect(mapStateToProps, null, null, { forwardRef: true })(NewPaymentRequest);
