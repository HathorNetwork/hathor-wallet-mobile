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
  Text,
  View,
} from 'react-native';
import { connect } from 'react-redux';

import hathorLib from '@hathor/wallet-lib';
import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import FeedbackModal from '../components/FeedbackModal';
import Spinner from '../components/Spinner';
import { newToken, updateSelectedToken } from '../actions';
import { Strong } from '../utils';
import checkIcon from '../assets/images/icCheckBig.png';
import errorIcon from '../assets/images/icErrorBig.png';


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

  getData = () => {
    const walletData = hathorLib.wallet.getWalletData();
    if (walletData === null) {
      return { error: 'Wallet not correctly initialized' };
    }
    const historyTransactions = 'historyTransactions' in walletData ? walletData.historyTransactions : {};
    const inputsData = hathorLib.wallet.getInputsFromAmount(
      historyTransactions,
      hathorLib.helpers.minimumAmount(),
      hathorLib.constants.HATHOR_TOKEN_CONFIG.uid,
    );
    if (inputsData.inputs.length === 0) {
      return { error: 'You don\'t have any Hathor tokens (HTR) available to create your token.' };
    }

    const input = inputsData.inputs[0];
    const amount = inputsData.inputsAmount;
    const outputChange = hathorLib.wallet.getOutputChange(
      amount, hathorLib.constants.HATHOR_TOKEN_INDEX
    );

    return { input, output: outputChange };
  }

  executeCreate = (pin) => {
    // show loading modal
    this.setState({
      modal:
        // eslint-disable-next-line react/jsx-indent
        <FeedbackModal
          icon={<Spinner />}
          text='Creating token'
        />,
    });
    const data = this.getData();
    if (data.error) {
      this.onError(data.error);
      return;
    }
    const address = hathorLib.wallet.getAddressToUse();
    const retPromise = hathorLib.tokens.createToken(
      data.input, data.output, address, this.name, this.symbol, this.amount, pin
    );
    retPromise.then((token) => {
      this.onSuccess(token);
    }, (message) => {
      this.onError(message);
    });
  }

  onSendPress = () => {
    const params = {
      cb: this.executeCreate,
      screenText: 'Enter your 6-digit pin to create your token',
      biometryText: 'Authorize token creation',
      canCancel: true,
    };
    this.props.navigation.navigate('PinScreen', params);
  }

  onSuccess = (token) => {
    this.props.newToken(token);
    this.props.updateSelectedToken(token);
    this.setState({
      modal:
        // eslint-disable-next-line react/jsx-indent
        <FeedbackModal
          icon={<Image source={checkIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />}
          text={<Text><Strong>{this.name}</Strong> created successfully</Text>}
          onDismiss={this.exitScreen}
        />,
    });
  }

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

  exitScreen = () => {
    this.setState({ modal: null });
    this.props.navigation.navigate('CreateTokenDetail');
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title='CREATE TOKEN'
          onBackPress={() => this.props.navigation.goBack()}
          onCancel={() => this.props.navigation.dismiss()}
        />
        {this.state.modal}
        <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
          <View>
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <InputLabel style={{ textAlign: 'center', marginBottom: 16 }}>
                {`Amount of ${this.name}`}
              </InputLabel>
              <AmountTextInput
                editable={false}
                value={hathorLib.helpers.prettyValue(this.amount)}
              />
            </View>
            <SimpleInput
              label='Token name'
              editable={false}
              value={this.name}
              containerStyle={{ marginTop: 48 }}
            />
            <SimpleInput
              label='Token symbol'
              editable={false}
              value={this.symbol}
              containerStyle={{ marginTop: 32 }}
            />
            <SimpleInput
              label='Deposit'
              editable={false}
              value={`${hathorLib.helpers.prettyValue(hathorLib.helpers.getDepositAmount(this.amount))} HTR`}
              containerStyle={{ marginTop: 32 }}
            />
          </View>
          <NewHathorButton
            title='Create token'
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

export default connect(null, mapDispatchToProps)(CreateTokenConfirm);
