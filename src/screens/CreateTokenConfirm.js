/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Image, View, } from 'react-native';
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
  useWalletService: state.useWalletService,
  isShowingPinScreen: state.isShowingPinScreen,
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
    this.amount = this.props.route.params.amount;
    this.name = this.props.route.params.name;
    this.symbol = this.props.route.params.symbol;
    this.nativeSymbol = this.props.wallet.storage.getNativeTokenData().symbol;
  }

  /**
   * Prepare data and execute create token
   * If success when preparing, show feedback modal, otherwise show error
   *
   * @param {String} pinCode User PIN
   */
  executeCreate = async (pin) => {
    if (this.props.useWalletService) {
      await this.props.wallet.validateAndRenewAuthToken(pin);
    }

    const { address } = await this.props.wallet.getCurrentAddress({ markAsUsed: true });
    this.props.wallet.prepareCreateNewToken(
      this.name,
      this.symbol,
      this.amount,
      { address, pinCode: pin }
    ).then((tx) => {
      let sendTransaction;
      if (this.props.useWalletService) {
        sendTransaction = new hathorLib.SendTransactionWalletService(
          this.props.wallet,
          { transaction: tx }
        );
      } else {
        sendTransaction = new hathorLib.SendTransaction(
          { storage: this.props.wallet.storage, transaction: tx, pin }
        );
      }

      const promise = sendTransaction.runFromMining();

      // show loading modal
      this.setState({
        modalType: 'SendTransactionFeedbackModal',
        modal: {
          text: t`Creating token`,
          sendTransaction,
          promise,
        },
      });
    }, (err) => {
      this.onError(err.message);
    });
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
      biometryLoadingText: t`Building transaction`,
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
    this.props.wallet.storage.registerToken(token);
  }

  /**
   * Show error message if there is one while creating the token
   *
   * @param {String} message Error message
   */
  onError = (message) => {
    this.setState({
      modalType: 'FeedbackModal',
      modal: {
        icon: <Image source={errorIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />,
        text: message,
        onDismiss: () => this.setState({ modal: null }),
      },
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
      <View style={{ flex: 1 }}>
        <HathorHeader
          title={t`CREATE TOKEN`}
          onBackPress={() => this.props.navigation.goBack()}
          onCancel={() => this.props.navigation.getParent().goBack()}
        />

        { this.state.modal && (
          this.state.modalType === 'FeedbackModal' ? (
            // eslint-disable-next-line react/jsx-indent
            <FeedbackModal
              icon={this.modal.icon}
              text={this.modal.message}
              onDismiss={this.modal.onDismiss}
            />
          ) : (
            // eslint-disable-next-line react/jsx-indent
            <SendTransactionFeedbackModal
              text={this.state.modal.text}
              sendTransaction={this.state.modal.sendTransaction}
              promise={this.state.modal.promise}
              successText={<TextFmt>{t`**${this.name}** created successfully`}</TextFmt>}
              onTxSuccess={this.onTxSuccess}
              onDismissSuccess={this.exitScreen}
              onDismissError={() => this.setState({ modal: null })}
              hide={this.props.isShowingPinScreen}
            />
          )
        )}

        <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
          <View>
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <InputLabel style={{ textAlign: 'center', marginBottom: 16 }}>
                {t`Amount of ${this.name}`}
              </InputLabel>
              <AmountTextInput
                editable={false}
                value={hathorLib.numberUtils.prettyValue(this.amount)}
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
              value={`${hathorLib.numberUtils.prettyValue(
                hathorLib.tokensUtils.getDepositAmount(this.amount)
              )} ${this.nativeSymbol}`}
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
      </View>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(CreateTokenConfirm);
