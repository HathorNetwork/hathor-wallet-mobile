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

import {
  buildTokenSwap,
  renderAmountAndSymbol,
  renderAmountAndSymbolWithSlippage,
  renderConversionRate,
  selectTokenSwapContractId,
} from '../utils/tokenSwap';
import NewHathorButton from '../components/NewHathorButton';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import SendTransactionFeedbackModal from '../components/SendTransactionFeedbackModal';
import { COLORS } from '../styles/themes';
import { useNavigation, useParams } from '../hooks/navigation';
import NavigationService from '../NavigationService';
import { ArrowDownIcon } from '../components/Icons/ArrowDown.icon';
import TextFmt from '../components/TextFmt';
import { tokenSwapFetchSwapQuote, tokenSwapResetSwapData } from '../actions';
import { TOKEN_SWAP_SLIPPAGE } from '../constants';
import Spinner from '../components/Spinner';
import FeedbackModal from '../components/FeedbackModal';

const TokenSwapReview = () => {
  const dispatch = useDispatch();

  const wallet = useSelector((state) => state.wallet);
  const useWalletService = useSelector((state) => state.useWalletService);
  const isShowingPinScreen = useSelector((state) => state.isShowingPinScreen);
  const contractId = useSelector(selectTokenSwapContractId);

  const {
    quote,
    tokenIn,
    tokenOut,
  } = useParams();
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigation = useNavigation();

  /**
   * Method executed after dismiss success modal
   */
  const exitToMainScreen = () => {
    setModal(null);
    dispatch(tokenSwapResetSwapData());
    NavigationService.resetToMain();
  };

  /**
   * Method executed after dismiss success modal
   */
  const exitOnError = () => {
    setModal(null);
    dispatch(tokenSwapFetchSwapQuote(
      quote.direction,
      quote.direction === 'input' ? quote.amount_in : quote.amount_out,
      tokenIn.uid,
      tokenOut.uid
    ));
    navigation.goBack();
  };

  const executeSend = async (pin) => {
    try {
      setLoading(true);

      const address = await wallet.getAddressAtIndex(0);
      const [method, data] = buildTokenSwap(
        contractId,
        address,
        quote,
        tokenIn.uid,
        tokenOut.uid,
        TOKEN_SWAP_SLIPPAGE,
      );
      if (useWalletService) {
        await wallet.validateAndRenewAuthToken(pin);
      }
      const sendTransaction = await wallet.createNanoContractTransaction(
        method,
        address,
        data,
        { pinCode: pin },
      );
      const promise = sendTransaction.runFromMining();

      setLoading(false);

      // show loading modal
      setModal({
        text: t`Your transfer is being processed`,
        sendTransaction,
        promise,
      });
    } catch(err) {
      console.error(err);
      this.exitOnError();
    } finally {
      setLoading(false);
    }
  };

  const onSwapButtonPress = () => {
    const pinParams = {
      cb: executeSend,
      canCancel: true,
      screenText: t`Enter your 6-digit pin to authorize operation`,
      biometryText: t`Authorize operation`,
      biometryLoadingText: t`Building transaction`,
    };
    navigation.navigate('PinScreen', pinParams);
  };

  return (
    <View style={styles.screenContent}>
      <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()}>
        <HathorHeader
          withBorder
          title={t`REVIEW TOKEN SWAP`}
          onBackPress={exitToMainScreen}
        />

        {loading && (
          <FeedbackModal
            text='Building the token swap'
            icon={<Spinner />}
          />
        )}

        {modal && (
          <SendTransactionFeedbackModal
            text={modal.text}
            sendTransaction={modal.sendTransaction}
            promise={modal.promise}
            successText={<TextFmt>{t`Your swap was successful`}</TextFmt>}
            onDismissSuccess={exitToMainScreen}
            onDismissError={exitOnError}
            hide={isShowingPinScreen}
          />
        )}

        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getStatusBarHeight()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View>
              <View style={styles.card}>
                <View style={styles.tokenContainer}>
                  <Text style={styles.tokenHeader}>Swapping</Text>
                  <Text style={styles.tokenValue}>
                    {renderAmountAndSymbol(quote.amount_in, tokenIn)}
                  </Text>
                </View>
                <ArrowDownIcon color={COLORS.primary} />
                <View style={styles.tokenContainer}>
                  <Text style={styles.tokenHeader}>To</Text>
                  <Text style={styles.tokenValue}>
                    {renderAmountAndSymbol(quote.amount_out, tokenOut)}
                  </Text>
                </View>
              </View>

              <View style={styles.quoteContainer}>
                <View style={styles.quoteRow}>
                  <Text style={{ fontWeight: 'bold', color: COLORS.primary }}>Swap Details</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteHeader}>Conversion rate</Text>
                  <Text style={styles.quoteValue}>
                    {renderConversionRate(quote, tokenIn, tokenOut)}
                  </Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteHeader}>Slippage</Text>
                  <Text style={styles.quoteValue}>{`${TOKEN_SWAP_SLIPPAGE}%`}</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteHeader}>Price impact</Text>
                  <Text style={styles.quoteValue}>{`${quote.price_impact / 100}%`}</Text>
                </View>
                { quote.direction === 'input' && (
                  <View style={styles.quoteRow}>
                    <Text style={styles.quoteHeader}>Minimum received</Text>
                    <Text style={styles.quoteValue}>{renderAmountAndSymbolWithSlippage('input', quote.amount_out, tokenOut, TOKEN_SWAP_SLIPPAGE)}</Text>
                  </View>
                )}
                { quote.direction === 'output' && (
                  <View style={styles.quoteRow}>
                    <Text style={styles.quoteHeader}>Maximum to deposit</Text>
                    <Text style={styles.quoteValue}>{renderAmountAndSymbolWithSlippage('output', quote.amount_in, tokenIn, TOKEN_SWAP_SLIPPAGE)}</Text>
                  </View>
                )}
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
    backgroundColor: '#fff',
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
    shadowColor: '#ababab',
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
