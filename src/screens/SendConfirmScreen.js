/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image } from 'react-native';
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
import FeedbackModal from '../components/FeedbackModal';
import Spinner from '../components/Spinner';
import { renderValue, isTokenNFT } from '../utils';
import NavigationService from '../NavigationService';
import { useNavigation, useParams } from '../hooks/navigation';
import { COLORS } from '../styles/themes';
import { InfoCircleIcon } from '../components/Icons/InfoCircle';
import { CheckIcon } from '../components/Icons/Check.icon';
import { TOKEN_DEPOSIT_URL, TOKEN_FEES_URL } from '../constants';
import errorIcon from '../assets/images/icErrorBig.png';

const PHASE = Object.freeze({
  BUILDING: 'building',
  ERROR: 'error',
  READY: 'ready',
});

function NoFee() {
  return (
    <View style={styles.nofee}>
      <CheckIcon size={16} color='#2E701F' />
      <Text style={{ color: '#2E701F' }}>{t`No fee`}</Text>
    </View>
  );
}

// Translates wallet-lib error messages to user-friendly text. The UTXO
// patterns apply during build (auto-selection in prepare-tx); other errors
// (auth, signing, mining) fall through to the original lib message.
function mapTxError(err) {
  const msg = err?.message || '';
  const htrUid = hathorLib.constants.NATIVE_TOKEN_UID;
  if (msg.includes(`No UTXOs available for the token ${htrUid}`)) {
    return t`Insufficient HTR to cover the network fee.`;
  }
  if (msg.includes('No UTXOs available for the token')) {
    return t`Insufficient balance to send this transaction.`;
  }
  return msg || t`Failed to process transaction.`;
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

  const [phase, setPhase] = useState(PHASE.BUILDING);
  const [sendTx, setSendTx] = useState(null);
  const [buildError, setBuildError] = useState(null);
  const [modal, setModal] = useState(null);
  const [isTooltipShown, setIsTooltipShown] = useState(false);
  // Disables the Send button from the moment it's tapped until the screen is
  // interactive again, closing the window between the PinScreen dismissal and
  // the feedback modal render where the button would otherwise be tappable.
  const [isSending, setIsSending] = useState(false);

  const nativeSymbol = hathorLib.constants.DEFAULT_NATIVE_TOKEN_CONFIG.symbol;

  // Build the transaction on mount (without inputs — let the lib auto-select
  // FBT and HTR UTXOs). This produces the exact fee the user will pay, which
  // we then show on the review screen.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const outputs = [{ address, value: amount, token: token.uid }];
        const sendTransaction = useWalletService
          ? new hathorLib.SendTransactionWalletService(wallet, { outputs })
          : new hathorLib.SendTransaction({ storage: wallet.storage, outputs });

        await sendTransaction.run('prepare-tx');

        if (cancelled) {
          try { await sendTransaction.releaseUtxos(); } catch (e) { console.error(e); }
          return;
        }

        setSendTx(sendTransaction);
        setPhase(PHASE.READY);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setBuildError({ message: mapTxError(err) });
        setPhase(PHASE.ERROR);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Release reserved UTXOs on unmount. Safe to call unconditionally:
  // no-op if the tx was already broadcast (UTXOs already cleared from the
  // selection map) and skipped if no tx was built.
  useEffect(() => () => {
    if (sendTx) {
      sendTx.releaseUtxos().catch((err) => console.error(err));
    }
  }, [sendTx]);

  // Re-enable the Send button whenever this screen regains focus. This covers
  // the PinScreen being dismissed by cancel or hardware back (neither sets the
  // feedback modal).
  useEffect(() => {
    const focusListener = navigation.addListener('focus', () => {
      setIsSending(false);
    });

    return focusListener;
  }, [navigation]);

  const networkFee = phase === PHASE.READY && sendTx
    ? (sendTx.transaction.getFeeHeader()?.entries?.[0]?.amount ?? 0n)
    : null;

  /**
   * Sign and mine the pre-built transaction.
   * Returns the in-flight promise so the feedback modal can subscribe to it.
   * Any error along the path is mapped to user-friendly text before rejecting.
   *
   * @param {string} pin Validated user PIN
   * @returns {Promise<Transaction>}
   */
  const signAndSendTx = async (pin) => {
    try {
      if (useWalletService) {
        await wallet.validateAndRenewAuthToken(pin);
      }
      await wallet.signTx(sendTx.transaction, { pinCode: pin });
      return await sendTx.runFromMining();
    } catch (err) {
      console.error(err);
      throw new Error(mapTxError(err));
    }
  };

  /**
   * Called after PIN validation. Hands the running signAndSendTx promise to
   * the feedback modal — setModal is synchronous so the modal renders in the
   * same commit as the PinScreen dismissal, closing the window where the
   * Send button could be tapped again.
   *
   * @param {string} pin Validated user PIN
   */
  const executeSend = (pin) => {
    setModal({
      text: t`Your transfer is being processed`,
      sendTransaction: sendTx,
      promise: signAndSendTx(pin),
    });
  };

  /**
   * Executed when user clicks to send the tx and opens PIN screen
   */
  const onSendPress = () => {
    // Disable the button before opening the PinScreen so it can't be tapped
    // again while we return from it and build the feedback modal.
    setIsSending(true);
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

    NavigationService.resetToMain();

    // Give enough time for the navigation to complete so the user doesn't see
    // the SendStack reseting to the initial route.
    setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: initialRoute }] });
    }, 500);
  };

  const dismissBuildError = () => {
    navigation.goBack();
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
    if (token.version === TokenVersion.DEPOSIT) {
      // for deposit based tokens
      Linking.openURL(TOKEN_DEPOSIT_URL);
    } else {
      // for fee-based tokens and htr
      Linking.openURL(TOKEN_FEES_URL);
    }
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

  const renderNetworkFeeValue = () => {
    if (networkFee === null) {
      return <Text style={{ color: COLORS.textColorShadow }}>{t`Loading...`}</Text>;
    }
    if (networkFee > 0n) {
      return (
        <Text>
          {renderValue(networkFee, false)} {nativeSymbol}
        </Text>
      );
    }
    return <NoFee />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.lowContrastDetail }}>
      <HathorHeader
        withBorder
        title={t`SEND ${tokenNameUpperCase}`}
        onBackPress={() => navigation.goBack()}
      />

      {phase === PHASE.BUILDING && (
        <FeedbackModal
          text={t`Building your transaction`}
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

      {phase === PHASE.READY && (
        <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
          <View style={{ gap: 30 }}>
            <View style={{ alignItems: 'center', marginTop: 32 }}>
              <AmountTextInput
                editable={false}
                value={amountAndToken}
                // Stretch to the parent's width so the auto-shrink logic measures a
                // fixed column width. The parent is `alignItems: 'center'`, so without
                // this the input sizes to its content and the font-scaling feedback loop
                // collapses the size. `textAlign: 'center'` keeps the value centered.
                style={{ alignSelf: 'stretch' }}
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
                  {renderNetworkFeeValue()}
                </View>
                <View style={styles.summaryItem}>
                  <TextFmt>{t`**Total**`}</TextFmt>
                  <Text>{`${amountAndToken}${networkFee ? ` + ${renderValue(networkFee, false)} ${nativeSymbol}` : ''}`}</Text>
                </View>
              </View>
            </View>
          </View>
          <NewHathorButton
            title={t`Send`}
            onPress={onSendPress}
            // Disable once tapped (isSending) and while the feedback modal is
            // visible; re-enabled on screen focus or when the modal is dismissed.
            disabled={modal !== null || isSending}
          />
        </View>
      )}
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
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  summaryItem: {
    width: '100%',
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
