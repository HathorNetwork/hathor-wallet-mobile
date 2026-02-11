/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useSelector } from 'react-redux';
import { msgid, ngettext, t } from 'ttag';
import hathorLib, { TokenVersion } from '@hathor/wallet-lib';
import NewHathorButton from '../components/NewHathorButton';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import TextFmt from '../components/TextFmt';
import SendTransactionFeedbackModal from '../components/SendTransactionFeedbackModal';
import TooltipModal from '../components/TooltipModal';
import { renderValue, isTokenNFT } from '../utils';
import NavigationService from '../NavigationService';
import { useNavigation, useParams } from '../hooks/navigation';
import { COLORS } from '../styles/themes';
import { InfoCircleIcon } from '../components/Icons/InfoCircle';
import { CheckIcon } from '../components/Icons/Check.icon';
import { TOKEN_DEPOSIT_URL } from '../constants';

function NoFee() {
  return (
    <View style={styles.nofee}>
      <CheckIcon size={16} color='#2E701F' />
      <Text style={{ color: '#2E701F' }}>No fee</Text>
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
  const [isTooltipShown, setIsTooltipShown] = useState(false);

  useEffect(() => {
    (async () => {
      if (token.version !== TokenVersion.FEE) {
        setNetworkFee(0n);
        return;
      }
      try {
        const { changeAmount } = await wallet.getUtxosForAmount(amount, { token: token.uid });
        if (changeAmount) {
          // Since there is change, it means we will have the intended output and a change output.
          // 2 FBT outputs means the fee value will be payed twice
          setNetworkFee(2n);
        } else {
          // No change means that there will only be the intended output.
          setNetworkFee(1n);
        }
      } catch (err) {
        setNetworkFee(1n);
      }
    })();
  }, [wallet, token, amount]);

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

  const handleFeeInfoPress = () => {
    setIsTooltipShown(true);
  };

  const handleTooltipLinkPress = () => {
    setIsTooltipShown(false);
    // Navigate to external link
    Linking.openURL(TOKEN_DEPOSIT_URL);
  };

  const getTooltipMessage = () => {
    if (networkFee === null) {
      return t`Loading fee information...`;
    }
    if (token.uid === hathorLib.constants.NATIVE_TOKEN_UID) {
      return t`This is the native token, no network fees are charged.`;
    }
    if (networkFee === 0n) {
      return t`This token is Deposit Based, no network fee will be charged.`;
    }
    return t`This fee is fixed and required for every transfer of this token.`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.lowContrastDetail }}>
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

      <TooltipModal
        visible={isTooltipShown}
        onDismiss={() => setIsTooltipShown(false)}
        message={getTooltipMessage()}
        linkText={t`Read more.`}
        onLinkPress={handleTooltipLinkPress}
      />

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
                <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                  <TextFmt>{t`**Network Fee**`}</TextFmt>
                  <TouchableOpacity onPress={handleFeeInfoPress} style={{ marginLeft: 4 }}>
                    <InfoCircleIcon size={16} />
                  </TouchableOpacity>
                </View>
                { networkFee
                  ? (<Text>{renderValue(networkFee, false)} HTR</Text>)
                  : (<NoFee />)}
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
    backgroundColor: '#EEFBEB',
    alignItems: 'center',
  },
});

export default SendConfirmScreen;
