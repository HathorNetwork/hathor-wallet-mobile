/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Image, SafeAreaView, View } from 'react-native';
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
import FeedbackModal from '../components/FeedbackModal';
import SendTransactionFeedbackModal from '../components/SendTransactionFeedbackModal';
import errorIcon from '../assets/images/icErrorBig.png';
import { sendTx } from '../actions';


/**
 * tokensBalance {Object} dict with balance for each token
 */
const mapStateToProps = (state) => ({
  tokensBalance: state.tokensBalance,
});

const mapDispatchToProps = (dispatch) => ({
  sendTx: (amount, address, token, pin) => dispatch(sendTx(amount, address, token, pin)),
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
    this.amount = this.props.navigation.getParam('amount');
    this.address = this.props.navigation.getParam('address');
    this.token = this.props.navigation.getParam('token');
    this.amountAndToken = `${hathorLib.helpers.prettyValue(this.amount)} ${this.token.symbol}`;
  }

  /**
   * In case we can prepare the data, open send tx feedback modal (while sending the tx)
   * Otherwise, show error
   *
   * @param {String} pinCode User PIN
   */
  executeSend = (pinCode) => {
    const ret = this.props.sendTx(this.amount, this.address, this.token, pinCode);
    if (ret.success) {
      // show loading modal
      this.setState({
        modal:
          // eslint-disable-next-line react/jsx-indent
          <SendTransactionFeedbackModal
            text={t`Your transfer is being processed`}
            sendTransaction={ret.sendTransaction}
            successText={<TextFmt>{t`Your transfer of **${this.amountAndToken}** has been confirmed`}</TextFmt>}
            onDismissSuccess={this.exitScreen}
            onDismissError={() => this.setState({ modal: null })}
          />,
      });
    } else {
      this.onError(ret.message);
    }
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
   * Show error message if there is one while sending the tx
   *
   * @param {String} message Error message
   */
  onError = (message) => {
    this.setState({
      modal:
        // eslint-disable-next-line react/jsx-indent
        <FeedbackModal
          icon={<Image source={errorIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />}
          text={message}
          onDismiss={() => this.setState({ modal: null })}
        />,
    });
  }

  /**
   * Method executed after dismiss success modal
   */
  exitScreen = () => {
    this.setState({ modal: null });
    this.props.navigation.popToTop();
    this.props.navigation.dismiss();
  }

  render() {
    const getAvailableString = () => {
      // eg: '23.56 HTR available'
      const balance = this.props.tokensBalance[this.token.uid];
      const available = balance ? balance.available : 0;
      const amountAndToken = `${hathorLib.helpers.prettyValue(available)} ${this.token.symbol}`;
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
        {this.state.modal}
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

export default connect(mapStateToProps, mapDispatchToProps)(SendConfirmScreen);
