/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Image,
  SafeAreaView,
  View,
} from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';

import hathorLib from '@hathor/wallet-lib';
import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import FeedbackModal from '../components/FeedbackModal';
import SendTransactionFeedbackModal from '../components/SendTransactionFeedbackModal';
import TextFmt from '../components/TextFmt';
import { newToken, updateSelectedToken } from '../actions';
import errorIcon from '../assets/images/icErrorBig.png';

/**
 * wallet {HathorWallet} HathorWallet lib object
 */
const mapStateToProps = (state) => ({
  wallet: state.wallet,
});


const mapDispatchToProps = (dispatch) => ({
  newToken: (token) => dispatch(newToken(token)),
  updateSelectedToken: (token) => dispatch(updateSelectedToken(token)),
});

/**
 * This screen expect the following parameters on the navigation:
 * name {string} token name
 * symbol {string} token symbol
 * amount {int} amount of tokens to create
 */
class CreateTokenConfirm extends React.Component {
  /**
   * modal {FeedbackModal} modal to display. If null, do not display
   */
  state = {
    modal: null,
  };

  constructor(props) {
    super(props);
    this.amount = this.props.navigation.getParam('amount');
    this.name = this.props.navigation.getParam('name');
    this.symbol = this.props.navigation.getParam('symbol');
  }

  /**
   * Prepare data and execute create token
   * If success when preparing, show feedback modal, otherwise show error
   *
   * @param {String} pinCode User PIN
   */
  executeCreate = (pin) => {
    const address = this.props.wallet.getCurrentAddress({ markAsUsed: true }).address;
    const promise = this.props.wallet.createNewToken(
      this.name, this.symbol, this.amount, { address, pinCode: pin }
    );

    if (ret.success) {
      // show loading modal
      this.setState({
        modal:
          // eslint-disable-next-line react/jsx-indent
          <SendTransactionFeedbackModal
            text={t`Creating token`}
            sendTransaction={ret.sendTransaction}
            successText={<TextFmt>{t`**${this.name}** created successfully`}</TextFmt>}
            onTxSuccess={this.onTxSuccess}
            onDismissSuccess={this.exitScreen}
            onDismissError={() => this.setState({ modal: null })}
          />,
      });
    } else {
      this.onError(ret.message);
    }
  }

  /**
   * Executed when user clicks to create the token and opens the PIN screen
   */
  onSendPress = () => {
    const params = {
      cb: this.executeCreate,
      screenText: t`Enter your 6-digit pin to create your token`,
      biometryText: t`Authorize token creation`,
      canCancel: true,
    };
    this.props.navigation.navigate('PinScreen', params);
  }

  /**
   * Method execute after creating the token with success
   *
   * @param {Object} tx Create token tx data
   */
  onTxSuccess = (tx) => {
    const token = { uid: tx.hash, name: this.name, symbol: this.symbol };
    this.props.newToken(token);
    this.props.updateSelectedToken(token);
  }

  /**
   * Show error message if there is one while creating the token
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
    this.props.navigation.navigate('CreateTokenDetail');
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title={t`CREATE TOKEN`}
          onBackPress={() => this.props.navigation.goBack()}
          onCancel={() => this.props.navigation.dismiss()}
        />
        {this.state.modal}
        <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
          <View>
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <InputLabel style={{ textAlign: 'center', marginBottom: 16 }}>
                {t`Amount of ${this.name}`}
              </InputLabel>
              <AmountTextInput
                editable={false}
                value={hathorLib.helpers.prettyValue(this.amount)}
              />
            </View>
            <SimpleInput
              label={t`Token name`}
              editable={false}
              value={this.name}
              containerStyle={{ marginTop: 48 }}
            />
            <SimpleInput
              label={t`Token symbol`}
              editable={false}
              value={this.symbol}
              containerStyle={{ marginTop: 32 }}
            />
            <SimpleInput
              label={t`Deposit`}
              editable={false}
              value={`${hathorLib.helpers.prettyValue(hathorLib.tokens.getDepositAmount(this.amount))} HTR`}
              containerStyle={{ marginTop: 32 }}
            />
          </View>
          <NewHathorButton
            title={t`Create token`}
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

export default connect(mapStateToProps, mapDispatchToProps)(CreateTokenConfirm);
