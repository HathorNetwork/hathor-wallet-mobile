/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import hathorLib, { TokenVersion } from '@hathor/wallet-lib';
import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import SendTransactionFeedbackModal from '../components/SendTransactionFeedbackModal';
import TextFmt from '../components/TextFmt';
import { updateSelectedToken } from '../actions';
import { registerToken } from '../utils/tokens';
import { InfoCircleIcon } from '../components/Icons/InfoCircle';
import { useNavigation, useParams } from '../hooks/navigation';
import { getCreateTokenTitle } from '../utils';

const TokenTypeInfoBox = ({ tokenVersion }) => {
  let infoText = t`You chose to create a **Deposit-Based Token**, which requires a 1% HTR deposit.`;
  if (tokenVersion === TokenVersion.FEE) {
    infoText = t`You chose to create a **Fee-Based Token**, so a small fee will be applied to each future transaction of this token.`;
  }
  return (
    <View style={{
      marginTop: 16,
      padding: 16,
      backgroundColor: '#DAF1FF',
      borderRadius: 20,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    }}
    >
      <View style={{ margin: 8 }}>
        <InfoCircleIcon />
      </View>
      <TextFmt style={{ flexShrink: 1 }}>{infoText}</TextFmt>
    </View>
  );
}

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
  const dispatchUpdateSelectedToken = (token) => dispatch(updateSelectedToken(token));

  // Navigation and params hooks
  const navigation = useNavigation();
  const params = useParams();

  // Parse and store navigation params
  const { amount, name, symbol, tokenVersion } = params;
  const nativeSymbol = wallet.storage.getNativeTokenData().symbol;

  // Component state
  // A single modal drives the whole flow: it mounts showing a spinner while the
  // tx is prepared (sendTransaction/promise still null) and then tracks
  // mining/propagation once they are ready. Shape: { text, sendTransaction, promise }
  const [sendTransactionModal, setSendTransactionModal] = useState(null);
  // Disables the Create token button from the moment it's tapped until the screen
  // is interactive again, closing the window between the PinScreen dismissal and
  // the feedback modal render where the button would otherwise be tappable.
  const [isSending, setIsSending] = useState(false);
  const [title, setTitle] = useState(t`CREATE TOKEN`);
  const [deposit, setDeposit] = useState(null);
  const [networkFee, setNetworkFee] = useState(null);

  useEffect(() => {
    setTitle(getCreateTokenTitle(tokenVersion));
  }, [tokenVersion]);

  useEffect(() => {
    if (tokenVersion === TokenVersion.DEPOSIT) {
      setDeposit(hathorLib.tokensUtils.getDepositAmount(amount));
      setNetworkFee(null);
    } else if (tokenVersion === TokenVersion.FEE) {
      setDeposit(null);
      setNetworkFee(hathorLib.constants.FEE_PER_OUTPUT);
    } else {
      setDeposit(null);
      setNetworkFee(null);
    }
  }, [tokenVersion, amount]);

  // Re-enable the Create token button whenever this screen regains focus. This
  // covers the PinScreen being dismissed by cancel or hardware back (neither
  // sets the feedback modal).
  useEffect(() => {
    const focusListener = navigation.addListener('focus', () => {
      setIsSending(false);
    });

    return focusListener;
  }, [navigation]);

  /**
   * Prepare and create the token. The promise built here covers the whole flow —
   * prepare, then mine/propagate — so a failure while preparing surfaces as an
   * error in the same feedback modal.
   *
   * @param {String} pin User PIN
   */
  const executeCreate = (pin) => {
    const promise = (async () => {
      if (useWalletService) {
        await wallet.validateAndRenewAuthToken(pin);
      }

      const { address } = await wallet.getCurrentAddress({ markAsUsed: true });
      const tx = await wallet.prepareCreateNewToken(
        name,
        symbol,
        amount,
        { address, pinCode: pin, tokenVersion }
      );

      const sendTransaction = useWalletService
        ? new hathorLib.SendTransactionWalletService(wallet, { transaction: tx })
        : new hathorLib.SendTransaction({ storage: wallet.storage, transaction: tx, pin });

      // Hand the instance to the modal so it subscribes to mining events.
      setSendTransactionModal((prev) => ({ ...prev, sendTransaction, text: t`Creating token` }));

      return sendTransaction.runFromMining();
    })();

    setSendTransactionModal({
      text: t`Building the transaction`,
      sendTransaction: null,
      promise,
    });
  };

  /**
   * Executed when user clicks to create the token and opens the PIN screen
   */
  const onSendPress = () => {
    // Disable the button before opening the PinScreen so it can't be tapped
    // again while we return from it and build the feedback modal.
    setIsSending(true);
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
  const onTxSuccess = async (tx) => {
    const token = { uid: tx.hash, name, symbol, version: tokenVersion };
    await registerToken(wallet, dispatch, token);
    dispatchUpdateSelectedToken(token);
  };

  /**
   * Method executed after dismiss success modal
   */
  const exitScreen = () => {
    setSendTransactionModal(null);
    navigation.navigate('CreateTokenDetail');
  };

  // Keep the button disabled from the moment it's tapped (isSending) and while
  // the feedback modal (building spinner, mining progress or error) is on screen.
  const isCreatingToken = isSending || sendTransactionModal !== null;

  return (
    <View style={{ flex: 1 }}>
      <HathorHeader
        title={title}
        onBackPress={() => navigation.goBack()}
        onCancel={() => navigation.getParent().goBack()}
      />

      {sendTransactionModal && (
        <SendTransactionFeedbackModal
          text={sendTransactionModal.text}
          sendTransaction={sendTransactionModal.sendTransaction}
          promise={sendTransactionModal.promise}
          successText={<TextFmt>{t`**${name}** created successfully`}</TextFmt>}
          onTxSuccess={onTxSuccess}
          onDismissSuccess={exitScreen}
          onDismissError={() => setSendTransactionModal(null)}
          hide={isShowingPinScreen}
        />
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
              // Stretch to the parent's width so the auto-shrink logic measures a
              // fixed column width. The parent is `alignItems: 'center'`, so without
              // this the input sizes to its content and the font-scaling feedback loop
              // collapses the size. `textAlign: 'center'` keeps the value centered.
              style={{ alignSelf: 'stretch' }}
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
          { deposit != null && (
            <SimpleInput
              label={t`Deposit`}
              editable={false}
              value={`${hathorLib.numberUtils.prettyValue(deposit)} ${nativeSymbol}`}
              containerStyle={{ marginTop: 32 }}
            />
          )}
          { networkFee != null && (
            <SimpleInput
              label={t`Network fee`}
              editable={false}
              value={`${hathorLib.numberUtils.prettyValue(networkFee)} ${nativeSymbol}`}
              containerStyle={{ marginTop: 32 }}
            />
          )}
          { tokenVersion != null && <TokenTypeInfoBox tokenVersion={tokenVersion} /> }
        </View>
        <NewHathorButton
          title={t`Create token`}
          onPress={onSendPress}
          disabled={isCreatingToken}
        />
      </View>
      <OfflineBar />
    </View>
  );
};

export default CreateTokenConfirm;
