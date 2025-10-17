/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { t } from 'ttag';

import { renderValue } from '../utils';
import NewHathorButton from '../components/NewHathorButton';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import SendTransactionFeedbackModal from '../components/SendTransactionFeedbackModal';
import { COLORS } from '../styles/themes';
import { useNavigation, useParams } from '../hooks/navigation';
import NavigationService from '../NavigationService';
import { ArrowDownIcon } from '../components/Icons/ArrowDown.icon';
import TextFmt from '../components/TextFmt';


const TokenSwapReview = () => {
  const dispatch = useDispatch();

  const wallet = useSelector((state) => state.wallet);
  const useWalletService = useSelector((state) => state.useWalletService);
  const isShowingPinScreen = useSelector((state) => state.isShowingPinScreen);
  const { decimalPlaces } = useSelector((state) => ({
    decimalPlaces: state.serverInfo?.decimal_places
  }));

  const {
    inputToken,
    inputAmount,
    outputToken,
    outputAmount,
  } = useParams();
  const [modal, setModal] = useState(null);

  const navigation = useNavigation();

  const renderTokenAndValue = (value, token) => {
    return `${renderValue(value)} ${token.symbol}`;
  };

  /**
   * Method executed after dismiss success modal
   */
  const exitScreen = () => {
    setModal(null);

    NavigationService.resetToMain();
  };

  const executeSend = async (pin) => {
    // const outputs = [{ address, value: amount, token: token.uid }];
    let sendTransaction = {
      on: () => {}, // ignore event listeners in mock
    }

    // if (useWalletService) {
    //   // await wallet.validateAndRenewAuthToken(pin);

    //   // XXX: call nano contract
    //   sendTransaction = {};
    // } else {
    //   // XXX: call nano contract
    //   sendTransaction = {};
    // }

    // const promise = sendTransaction.run();
    // XXX: mock resolving tx in 5s
    const promise = new Promise(resolve => {
      setTimeout(() => resolve(), 1000);
    });

    // show loading modal
    setModal({
      text: t`Your transfer is being processed`,
      sendTransaction,
      promise,
    });
  };

  const onSwapButtonPress = () => {
    const pinParams = {
      cb: executeSend,
      canCancel: true,
      screenText: t`Enter your 6-digit pin to authorize operation`,
      biometryText: t`Authorize operation`,
      biometryLoadingText: t`Building transaction`,
    };
    NavigationService.navigate('PinScreen', pinParams);
  };

  return (
    <View style={styles.screenContent}>
      <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()}>
        <HathorHeader
          withBorder
          title={t`REVIEW TOKEN SWAP`}
          onBackPress={() => navigation.goBack()}
        />

        {modal && (
          <SendTransactionFeedbackModal
            text={modal.text}
            sendTransaction={modal.sendTransaction}
            promise={modal.promise}
            successText={<TextFmt>{t`Your swap was successful`}</TextFmt>}
            onDismissSuccess={exitScreen}
            onDismissError={() => setModal(null)}
            hide={isShowingPinScreen}
          />
        )}

        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getStatusBarHeight()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View>
              <View style={styles.card}>
                <View style={styles.tokenContainer}>
                  <Text style={styles.tokenHeader}>{"Swapping"}</Text>
                  <Text style={styles.tokenValue}>{renderTokenAndValue(inputAmount, inputToken)}</Text>
                </View>
                <ArrowDownIcon color={COLORS.primary} />
                <View style={styles.tokenContainer}>
                  <Text style={styles.tokenHeader}>{"To"}</Text>
                  <Text style={styles.tokenValue}>{renderTokenAndValue(outputAmount, outputToken)}</Text>
                </View>
              </View>

              <View style={styles.quoteContainer}>
                <View style={styles.quoteRow}>
                  <Text style={{ fontWeight: 'bold', color: COLORS.primary}}>{"Swap Details"}</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteHeader}>{"Conversion rate"}</Text>
                  <Text style={styles.quoteValue}>{"15.60 HTR = 6.41 CTHOR"}</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteHeader}>{"Slippage"}</Text>
                  <Text style={styles.quoteValue}>{"0.5%"}</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteHeader}>{"Price impact"}</Text>
                  <Text style={styles.quoteValue}>{"-0.4%"}</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteHeader}>{"Minimum received"}</Text>
                  <Text style={styles.quoteValue}>{"6.41 CTHOR"}</Text>
                </View>
              </View>
            </View>

            <NewHathorButton
              title={t`SWAP`}
              onPress={onSwapButtonPress}
              disabled={modal !== null}
            />
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  error: {
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
    color: COLORS.errorTextColor,
  },
  screenContent: {
    flex: 1,
    backgroundColor: COLORS.lowContrastDetail,
  },
  tokenContainer: {
    flexDirection: 'column',
    padding: 10,
  },
  tokenHeader: {
    fontSize: 12,
    fontWeight: 200,
  },
  tokenValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  card: {
    zIndex: 1,
    borderRadius: 20,
    padding: 10,
    backgroundColor: COLORS.backgroundColor,
    alignItems: 'left',
    justifyContent: 'flex-start',
    // For IOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3.84,
    // For Android
    elevation: 5,
  },
  quoteContainer: {
    paddingTop: 40,
    padding: 20,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 4,
  },
  quoteHeader: {
    fontWeight: 'bold',
  },
  quoteValue: {
    fontWeight: 200,
  },
});

export default TokenSwapReview;
