/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { SafeAreaView, View } from 'react-native';
import { connect } from 'react-redux';
import { t, ngettext, msgid } from 'ttag';

import hathorLib from '@hathor/wallet-lib';
import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import TextFmt from '../components/TextFmt';
import SendTransactionFeedbackModal from '../components/SendTransactionFeedbackModal';
import { renderValue, isTokenNFT } from '../utils';


/**
 * tokensBalance {Object} dict with balance for each token
 * wallet {HathorWallet} HathorWallet lib object
 * tokenMetadata {Object} metadata of tokens
 */
const mapStateToProps = (state) => ({
  tokensBalance: state.tokensBalance,
  wallet: state.wallet,
  useWalletService: state.useWalletService,
  tokenMetadata: state.tokenMetadata,
  isShowingPinScreen: state.isShowingPinScreen,
});

class SendConfirmScreen extends React.Component {
  /**
   * modal {FeedbackModal|SendTransactionFeedbackModal} modal to display. If null, do not display
   * }
   */
  state = {
    modal: null,
  };

  /**
   * amount {int} amount to send
   * address {string} address to send to
   * token {object} info about the selected token to send
   */
  constructor(props) {
    super(props);
    // we receive these 3 values from previous screens
    this.amount = this.props.route.params.amount;
    this.address = this.props.route.params.address;
    this.token = this.props.route.params.token;
    this.isNFT = isTokenNFT(this.token.uid, this.props.tokenMetadata);
    this.amountAndToken = `${renderValue(this.amount, this.isNFT)} ${this.token.symbol}`;
  }

  /**
   * In case we can prepare the data, open send tx feedback modal (while sending the tx)
   * Otherwise, show error
   *
   * @param {String} pin User PIN already validated
   */
  executeSend = async (pin) => {
    const outputs = [{ address: this.address, value: this.amount, token: this.token.uid }];
    let sendTransaction;

    if (this.props.useWalletService) {
      await this.props.wallet.validateAndRenewAuthToken(pin);

      sendTransaction = new hathorLib.SendTransactionWalletService(this.props.wallet, {
        outputs,
        pin,
      });
    } else {
      sendTransaction = new hathorLib.SendTransaction(
        { storage: this.props.wallet.storage, outputs, pin }
      );
    }

    const promise = sendTransaction.run();

    // show loading modal
    this.setState({
      modal: {
        text: t`Your transfer is being processed`,
        sendTransaction,
        promise,
      }
    });
  }

  /**
   * Executed when user clicks to send the tx and opens PIN screen
   */
  onSendPress = () => {
    const params = {
      cb: this.executeSend,
      canCancel: true,
      screenText: t`Enter your 6-digit pin to authorize operation`,
      biometryText: t`Authorize operation`,
    };
    this.props.navigation.navigate('PinScreen', params);
  }

  /**
   * Method executed after dismiss success modal
   */
  exitScreen = () => {
    this.setState({ modal: null });
    // Return to the dashboard, clean all navigtation history
    this.props.navigation.reset({
      index: 0,
      routes: [
        { name: 'App', params: { screen: 'Main', params: { screen: 'Home' } } },
      ]
    });
  }

  render() {
    const getAvailableString = () => {
      // eg: '23.56 HTR available'
      const balance = this.props.tokensBalance[this.token.uid].data;
      const available = balance ? balance.available : 0;
      const amountAndToken = `${renderValue(available, this.isNFT)} ${this.token.symbol}`;
      return ngettext(msgid`${amountAndToken} available`, `${amountAndToken} available`, available);
    };

    const tokenNameUpperCase = this.token.name.toUpperCase();
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          withBorder
          title={t`SEND ${tokenNameUpperCase}`}
          onBackPress={() => this.props.navigation.goBack()}
        />

        {this.state.modal && (
          <SendTransactionFeedbackModal
            text={this.state.modal.text}
            sendTransaction={this.state.modal.sendTransaction}
            promise={this.state.modal.promise}
            successText={<TextFmt>{t`Your transfer of **${this.amountAndToken}** has been confirmed`}</TextFmt>}
            onDismissSuccess={this.exitScreen}
            onDismissError={() => this.setState({ modal: null })}
            hide={this.props.isShowingPinScreen}
          />
        )}

        <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
          <View>
            <View style={{ alignItems: 'center', marginTop: 32 }}>
              <AmountTextInput
                editable={false}
                value={this.amountAndToken}
              />
              <InputLabel style={{ marginTop: 8 }}>
                {getAvailableString()}
              </InputLabel>
            </View>
            <SimpleInput
              label={t`Address`}
              editable={false}
              value={this.address}
              containerStyle={{ marginTop: 48 }}
            />
          </View>
          <NewHathorButton
            title={t`Send`}
            onPress={this.onSendPress}
            // disable while modal is visible
            disabled={this.state.modal !== null}
          />
        </View>
        <OfflineBar />
      </SafeAreaView>
    );
  }
}

export default connect(mapStateToProps)(SendConfirmScreen);
