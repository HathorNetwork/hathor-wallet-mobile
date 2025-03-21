/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import {
  Image,
  View,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
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
import { useNavigation, useParams } from '../hooks/navigation';

/**
 * This component expects the following parameters in navigation:
 * name {string} token name
 * symbol {string} token symbol
 * amount {bigint} amount of tokens to create
 */
const CreateTokenConfirm = () => {
  // Hooks to replace mapStateToProps and mapDispatchToProps
  const wallet = useSelector((state) => state.wallet);
  const useWalletService = useSelector((state) => state.useWalletService);
  const isShowingPinScreen = useSelector((state) => state.isShowingPinScreen);
  const decimalPlaces = useSelector((state) => state.serverInfo?.decimal_places);

  const dispatch = useDispatch();
  const dispatchNewToken = (token) => dispatch(newToken(token));
  const dispatchUpdateSelectedToken = (token) => dispatch(updateSelectedToken(token));

  // Navigation and params hooks
  const navigation = useNavigation();
  const params = useParams();

  // Parse and store navigation params
  const { amount, name, symbol } = params;
  const nativeSymbol = wallet.storage.getNativeTokenData().symbol;

  // Component state
  const [modal, setModal] = useState(null);
  const [modalType, setModalType] = useState(null);

  /**
   * Prepare data and execute create token
   * If success when preparing, show feedback modal, otherwise show error
   *
   * @param {String} pinCode User PIN
   */
  const executeCreate = async (pin) => {
    if (useWalletService) {
      await wallet.validateAndRenewAuthToken(pin);
    }

    const { address } = await wallet.getCurrentAddress({ markAsUsed: true });
    wallet.prepareCreateNewToken(
      name,
      symbol,
      amount,
      { address, pinCode: pin }
    ).then((tx) => {
      let sendTransaction;
      if (useWalletService) {
        sendTransaction = new hathorLib.SendTransactionWalletService(
          wallet,
          { transaction: tx }
        );
      } else {
        sendTransaction = new hathorLib.SendTransaction(
          { storage: wallet.storage, transaction: tx, pin }
        );
      }

      const promise = sendTransaction.runFromMining();

      // show loading modal
      setModalType('SendTransactionFeedbackModal');
      setModal({
        text: t`Creating token`,
        sendTransaction,
        promise,
      });
    }, (err) => {
      onError(err.message);
    });
  };

  /**
   * Executed when user clicks to create the token and opens the PIN screen
   */
  const onSendPress = () => {
    const pinParams = {
      cb: executeCreate,
      screenText: t`Enter your 6-digit pin to create your token`,
      biometryText: t`Authorize token creation`,
      canCancel: true,
      biometryLoadingText: t`Building transaction`,
    };
    navigation.navigate('PinScreen', pinParams);
  };

  /**
   * Method execute after creating the token with success
   *
   * @param {Object} tx Create token tx data
   */
  const onTxSuccess = (tx) => {
    const token = { uid: tx.hash, name, symbol };
    dispatchNewToken(token);
    dispatchUpdateSelectedToken(token);
    wallet.storage.registerToken(token);
  };

  /**
   * Show error message if there is one while creating the token
   *
   * @param {String} message Error message
   */
  const onError = (message) => {
    setModalType('FeedbackModal');
    setModal({
      icon: <Image source={errorIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />,
      text: message,
      onDismiss: () => setModal(null),
    });
  };

  /**
   * Method executed after dismiss success modal
   */
  const exitScreen = () => {
    setModal(null);
    navigation.navigate('CreateTokenDetail');
  };

  return (
    <View style={{ flex: 1 }}>
      <HathorHeader
        title={t`CREATE TOKEN`}
        onBackPress={() => navigation.goBack()}
        onCancel={() => navigation.getParent().goBack()}
      />

      {modal && (
        modalType === 'FeedbackModal' ? (
          <FeedbackModal
            icon={modal.icon}
            text={modal.text}
            onDismiss={modal.onDismiss}
          />
        ) : (
          <SendTransactionFeedbackModal
            text={modal.text}
            sendTransaction={modal.sendTransaction}
            promise={modal.promise}
            successText={<TextFmt>{t`**${name}** created successfully`}</TextFmt>}
            onTxSuccess={onTxSuccess}
            onDismissSuccess={exitScreen}
            onDismissError={() => setModal(null)}
            hide={isShowingPinScreen}
          />
        )
      )}

      <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
        <View>
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <InputLabel style={{ textAlign: 'center', marginBottom: 16 }}>
              {t`Amount of ${name}`}
            </InputLabel>
            <AmountTextInput
              editable={false}
              decimalPlaces={decimalPlaces}
              value={hathorLib.numberUtils.prettyValue(amount)}
            />
          </View>
          <SimpleInput
            label={t`Token name`}
            editable={false}
            value={name}
            containerStyle={{ marginTop: 48 }}
          />
          <SimpleInput
            label={t`Token symbol`}
            editable={false}
            value={symbol}
            containerStyle={{ marginTop: 32 }}
          />
          <SimpleInput
            label={t`Deposit`}
            editable={false}
            value={`${hathorLib.numberUtils.prettyValue(
              hathorLib.tokensUtils.getDepositAmount(amount)
            )} ${nativeSymbol}`}
            containerStyle={{ marginTop: 32 }}
          />
        </View>
        <NewHathorButton
          title={t`Create token`}
          onPress={onSendPress}
          // disable while modal is visible
          disabled={modal !== null}
        />
      </View>
      <OfflineBar />
    </View>
  );
};

export default CreateTokenConfirm;
