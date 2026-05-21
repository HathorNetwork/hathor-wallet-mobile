/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
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
import hathorLib from '@hathor/wallet-lib';

import {
  buildTokenSwap,
  mapBuildError,
  renderAmountAndSymbol,
  renderAmountAndSymbolWithSlippage,
  renderConversionRate,
  selectTokenSwapContractId,
} from '../utils/tokenSwap';
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
import { tokenSwapResetSwapData } from '../actions';
import { registerToken, updateTokensMetadata } from '../utils/tokens';
import { TOKEN_SWAP_SLIPPAGE } from '../constants';
import Spinner from '../components/Spinner';
import FeedbackModal from '../components/FeedbackModal';
import errorIcon from '../assets/images/icErrorBig.png';

const PHASE = Object.freeze({
  BUILDING: 'building',
  ERROR: 'error',
  READY: 'ready',
});

const TokenSwapReview = () => {
  const dispatch = useDispatch();

  const wallet = useSelector((state) => state.wallet);
  const useWalletService = useSelector((state) => state.useWalletService);
  const isShowingPinScreen = useSelector((state) => state.isShowingPinScreen);
  const contractId = useSelector(selectTokenSwapContractId);

  const { quote, tokenIn, tokenOut } = useParams();

  const [phase, setPhase] = useState(PHASE.BUILDING);
  const [buildError, setBuildError] = useState(null);
  const [sendTx, setSendTx] = useState(null);
  const [modal, setModal] = useState(null);

  const registrationPromiseRef = useRef(null);
  const sentSuccessfullyRef = useRef(false);
  const releasedRef = useRef(false);

  const navigation = useNavigation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const address = await wallet.getAddressAtIndex(0);
        const [method, data] = buildTokenSwap(
          contractId,
          address,
          quote,
          tokenIn.uid,
          tokenOut.uid,
          TOKEN_SWAP_SLIPPAGE,
        );
        const tx = await wallet.createNanoContractTransaction(
          method,
          address,
          data,
          { signTx: false },
        );
        if (cancelled) {
          try { await tx.releaseUtxos(); } catch (e) { console.error(e); }
          return;
        }
        setSendTx(tx);
        setPhase(PHASE.READY);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setBuildError({ message: mapBuildError(err) });
        setPhase(PHASE.ERROR);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async (e) => {
      if (sentSuccessfullyRef.current || releasedRef.current || !sendTx) {
        return;
      }
      e.preventDefault();
      releasedRef.current = true;
      try { await sendTx.releaseUtxos(); } catch (err) { console.error(err); }
      navigation.dispatch(e.data.action);
    });
    return unsubscribe;
  }, [sendTx, navigation]);

  const networkFee = phase === PHASE.READY && sendTx
    ? (sendTx.transaction.getFeeHeader()?.entries?.[0]?.amount ?? 0n)
    : 0n;

  /**
   * Register a token if it's not already registered
   * @param {Object} token - Token to register with uid, name, and symbol properties
   */
  const registerTokenIfNeeded = async (token) => {
    const isRegistered = await wallet.storage.isTokenRegistered(token.uid);
    if (!isRegistered) {
      await registerToken(wallet, dispatch, token);
      await updateTokensMetadata(wallet, dispatch, [token.uid]);
    }
  };

  /**
   * Called when the swap transaction succeeds (while success modal is showing).
   * Starts token registration early so it's done/in-progress by the time user dismisses.
   * The promise is stored so exitToMainScreen can await completion before navigating.
   */
  const onSwapSuccess = () => {
    // Start registration in parallel and store promise for later awaiting
    sentSuccessfullyRef.current = true;
    registrationPromiseRef.current = Promise.all([
      registerTokenIfNeeded(tokenIn),
      registerTokenIfNeeded(tokenOut),
    ]).catch((err) => console.error(err));
  };

  /**
   * Method executed after dismiss success modal.
   * Awaits token registration completion before navigating.
   */
  const exitToMainScreen = async () => {
    if (registrationPromiseRef.current) {
      await registrationPromiseRef.current;
    }
    setModal(null);
    dispatch(tokenSwapResetSwapData());
    NavigationService.resetToMain();
  };

  // Closes the send-progress modal and navigates back. The beforeRemove
  // listener releases reserved UTXOs along the way.
  const exitOnError = () => {
    setModal(null);
    navigation.goBack();
  };

  // Build error: the lib already released UTXOs in its own catch, so there
  // is no sendTx to release here — just go back.
  const dismissBuildError = () => {
    navigation.goBack();
  };

  const executeSend = async (pin) => {
    try {
      if (useWalletService) {
        await wallet.validateAndRenewAuthToken(pin);
      }
      await wallet.signTx(sendTx.transaction, { pinCode: pin });
      const promise = sendTx.runFromMining();
      setModal({
        text: t`Your transfer is being processed`,
        sendTransaction: sendTx,
        promise,
      });
    } catch (err) {
      console.error(err);
      exitOnError();
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
          onBackPress={exitOnError}
        />

        {phase === PHASE.BUILDING && (
          <FeedbackModal
            text={t`Building the swap transaction for your review`}
            icon={<Spinner />}
          />
        )}

        {phase === PHASE.ERROR && buildError && (
          <FeedbackModal
            text={buildError.message}
            icon={<Image source={errorIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />}
            onDismiss={dismissBuildError}
          />
        )}

        {modal && (
          <SendTransactionFeedbackModal
            text={modal.text}
            sendTransaction={modal.sendTransaction}
            promise={modal.promise}
            successText={<TextFmt>{t`Your swap was successful`}</TextFmt>}
            onTxSuccess={onSwapSuccess}
            onDismissSuccess={exitToMainScreen}
            onDismissError={exitOnError}
            hide={isShowingPinScreen}
          />
        )}

        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getStatusBarHeight()}>
          {phase === PHASE.READY && (
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View>
              <View style={styles.card}>
                <View style={styles.tokenContainer}>
                  <Text style={styles.tokenHeader}>Swapping</Text>
                  <Text style={styles.tokenValue}>
                    {renderAmountAndSymbol(quote.amount_in, tokenIn)}
                  </Text>
                </View>
                <View style={styles.iconContainer}>
                  <ArrowDownIcon color={COLORS.primary} />
                </View>
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
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteHeader}>{t`Network Fee`}</Text>
                  <Text style={styles.quoteValue}>
                    {networkFee != null && networkFee > 0n
                      ? `${renderValue(networkFee, false)} ${hathorLib.constants.DEFAULT_NATIVE_TOKEN_CONFIG.symbol}`
                      : t`No fee`}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <NewHathorButton
                title={t`SWAP`}
                onPress={onSwapButtonPress}
                disabled={modal !== null}
              />
            </View>
          </View>
          )}
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
    marginTop: 8,
  },
  buttonContainer: {
    marginBottom: 16,
  },
  iconContainer: {
    paddingLeft: 6,
  },
  card: {
    zIndex: 1,
    borderRadius: 20,
    padding: 10,
    backgroundColor: COLORS.backgroundColor,
    alignItems: 'left',
    justifyContent: 'flex-start',
    // For IOS
    shadowColor: COLORS.lightShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    // For Android
    elevation: 2,
  },
  quoteContainer: {
    paddingTop: 40,
    padding: 20,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  quoteHeader: {
    fontWeight: '500',
  },
  quoteValue: {
    fontWeight: '300',
  },
});

export default TokenSwapReview;
