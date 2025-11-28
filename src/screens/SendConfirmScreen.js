/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { msgid, ngettext, t } from 'ttag';
import hathorLib from '@hathor/wallet-lib';
import NewHathorButton from '../components/NewHathorButton';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import TextFmt from '../components/TextFmt';
import SendTransactionFeedbackModal from '../components/SendTransactionFeedbackModal';
import { renderValue, isTokenNFT } from '../utils';
import NavigationService from '../NavigationService';
import { useNavigation, useParams } from '../hooks/navigation';
import { COLORS } from '../styles/themes';
import { DoneIcon } from '../components/Icons/Done.icon';

function NoFee() {
  return (
    <View style={styles.nofee}>
      <DoneIcon color={COLORS.white}/>
      <Text>No fee</Text>
    </View>
  );
}

const SendConfirmScreen = () => {
  const tokensBalance = useSelector((state) => state.tokensBalance);
  const wallet = useSelector((state) => state.wallet);
  const useWalletService = useSelector((state) => state.useWalletService);
  const tokenMetadata = useSelector((state) => state.tokenMetadata);
  const isShowingPinScreen = useSelector((state) => state.isShowingPinScreen);
  const isCameraAvailable = useSelector((state) => state.isCameraAvailable);

  const navigation = useNavigation();
  const params = useParams();

  // Parse and store navigation params
  const { amount, address, token } = params;
  const isNFT = isTokenNFT(token.uid, tokenMetadata);
  const amountAndToken = `${renderValue(amount, isNFT)} ${token.symbol}`;

  const [modal, setModal] = useState(null);
  const [networkFee, setNetworkFee] = useState(null);

  useEffect(() => {
    const calculateNetworkFee = async () => {
      // If the selected utxos amount is higher than `amount` we will have 2 outputs with the token
      // This can be calculated with the fee utils, but since they are not release yet we need to mock
      // FIXME: Will mock this case just to see UI.
      setNetworkFee(0n);
    };

    calculateNetworkFee();
  }, [token, amount]);

  /**
   * In case we can prepare the data, open send tx feedback modal (while sending the tx)
   * Otherwise, show error
   *
   * @param {String} pin User PIN already validated
   */
  const executeSend = async (pin) => {
    const outputs = [{ address, value: amount, token: token.uid }];
    let sendTransaction;

    if (useWalletService) {
      await wallet.validateAndRenewAuthToken(pin);

      sendTransaction = new hathorLib.SendTransactionWalletService(wallet, {
        outputs,
        pin,
      });
    } else {
      sendTransaction = new hathorLib.SendTransaction(
        { storage: wallet.storage, outputs, pin }
      );
    }

    const promise = sendTransaction.run();

    // show loading modal
    setModal({
      text: t`Your transfer is being processed`,
      sendTransaction,
      promise,
    });
  };

  /**
   * Executed when user clicks to send the tx and opens PIN screen
   */
  const onSendPress = () => {
    const pinParams = {
      cb: executeSend,
      canCancel: true,
      screenText: t`Enter your 6-digit pin to authorize operation`,
      biometryText: t`Authorize operation`,
      biometryLoadingText: t`Building transaction`,
    };
    navigation.navigate('PinScreen', pinParams);
  };

  /**
   * Method executed after dismiss success modal
   */
  const exitScreen = () => {
    setModal(null);

    // First reset the Send stack to its initial state so next time user starts fresh
    // We need to determine the correct initial route based on camera permission
    // This matches the logic in SendStack component
    let initialRoute = 'CameraPermissionScreen';
    if (isCameraAvailable) {
      initialRoute = 'SendScanQRCode';
    } else if (isCameraAvailable === false) { // might be null
      initialRoute = 'SendAddressInput';
    }

    NavigationService.navigate('Main', { screen: 'Home' });

    // Give enough time for the navigation to complete so the user doesn't see
    // the SendStack reseting to the initial route.
    setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: initialRoute }] });
    }, 500);
  };

  const getAvailableString = () => {
    const balance = tokensBalance[token.uid].data;
    const available = balance ? balance.available : 0;
    const availableCount = Number(available);
    const availablePretty = renderValue(available, isNFT);
    return ngettext(msgid`${availablePretty} available`, `${availablePretty} available`, availableCount);
  };

  const tokenNameUpperCase = token.name.toUpperCase();

  return (
    <View style={{ flex: 1 }}>
      <HathorHeader
        withBorder
        title={t`SEND ${tokenNameUpperCase}`}
        onBackPress={() => navigation.goBack()}
      />

      {modal && (
        <SendTransactionFeedbackModal
          text={modal.text}
          sendTransaction={modal.sendTransaction}
          promise={modal.promise}
          successText={<TextFmt>{t`Your transfer of **${amountAndToken}** has been confirmed`}</TextFmt>}
          onDismissSuccess={exitScreen}
          onDismissError={() => setModal(null)}
          hide={isShowingPinScreen}
        />
      )}

      <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
        <View style={{ gap: 30 }}>
          <View style={{ alignItems: 'center', marginTop: 32 }}>
            <AmountTextInput
              editable={false}
              value={amountAndToken}
            />
            <InputLabel style={{ marginTop: 8 }}>
              {getAvailableString()}
            </InputLabel>
          </View>
          <View>
            <TextFmt style={{ marginBottom: 10 }}>{t`**Transaction summary**`}</TextFmt>
            <View style={styles.summaryContainer}>
              <View style={styles.summaryItem}>
                <TextFmt>{t`**To**`}</TextFmt>
                <Text>{address.substr(0, 7)}...{address.substr(-7)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <TextFmt>{t`**Network Fee**`}</TextFmt>
                { networkFee
                  ? (<Text>{renderValue(networkFee, false)} HTR</Text>)
                  : (<NoFee/>)}
              </View>
              <View style={styles.summaryItem}>
                <TextFmt>{t`**Total**`}</TextFmt>
                <Text>{`${amountAndToken}${networkFee ? ` + ${renderValue(networkFee, false)} HTR` : ''}`}</Text>
              </View>
            </View>
          </View>
        </View>
        <NewHathorButton
          title={t`Send`}
          onPress={onSendPress}
          // disable while modal is visible
          disabled={modal !== null}
        />
      </View>
      <OfflineBar />
    </View>
  );
};

const styles = StyleSheet.create({
  summaryContainer: {
    zIndex: 1,
    borderRadius: 20,
    padding: 10,
    backgroundColor: COLORS.backgroundColor,
    alignItems: 'left',
    justifyContent: 'flex-start',
    // For IOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3.84,
    // For Android
    elevation: 5,
  },
  summaryItem: {
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nofee: {
    flexDirection: 'row',
    borderRadius: 10,
    paddingLeft: 5,
    paddingRight: 10,
    backgroundColor: COLORS.feedbackSuccess100,
  },
});

export default SendConfirmScreen;
