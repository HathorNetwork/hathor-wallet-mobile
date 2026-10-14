/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
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
import BackdropModal from '../components/BackdropModal';
import SendTransactionFeedbackModal from '../components/SendTransactionFeedbackModal';
import TooltipModal from '../components/TooltipModal';
import FeedbackModal from '../components/FeedbackModal';
import Spinner from '../components/Spinner';
import {
  isShieldedAddress,
  isTokenNFT,
  renderValue,
  shieldedAddressNotSupportedText,
} from '../utils';
import NavigationService from '../NavigationService';
import { useNavigation, useParams } from '../hooks/navigation';
import { COLORS } from '../styles/themes';
import { InfoCircleIcon } from '../components/Icons/InfoCircle';
import { CheckIcon } from '../components/Icons/Check.icon';
import { ChevronDownIcon } from '../components/Icons/ChevronDown.icon';
import { ChevronUpIcon } from '../components/Icons/ChevronUp.icon';
import { ShieldPadlockIcon } from '../components/Icons/ShieldPadlock.icon';
import {
  PRIVACY_MODE,
  SHIELDED_PROVIDER_STATUS,
  TOKEN_DEPOSIT_URL,
  TOKEN_FEES_URL,
} from '../constants';
import { authorizeTransaction } from '../passkey/authorizeTransaction';
import {
  buildSendOutput,
  computeSendFees,
  mapShieldedSendError,
  privacyModeToShieldedMode,
  waitForWalletReady,
} from '../utils/shieldedSend';
import { isShieldedEnvironment } from '../shielded/gating';
import { SHIELDED_UNLOCK_STATUS, unlockShieldedViewIfLocked } from '../shielded/unlock';
import { logger } from '../logger';
import errorIcon from '../assets/images/icErrorBig.png';

const log = logger('send-confirm');

const PHASE = Object.freeze({
  BUILDING: 'building',
  // A private send waits for the user to unlock the wallet's private balance with the PIN.
  LOCKED: 'locked',
  // The PIN unlocked the scan key, and the wallet decodes its private outputs.
  UNLOCKING: 'unlocking',
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

// wallet-lib's errors for a send that needs more inputs than a transaction can hold. The one
// thrown while selecting UTXOs can tell the user to consolidate the wallet's UTXOs, which this
// app has no way to do.
const INPUT_LIMIT_ERROR = /inputs, more than the \d+ a transaction can hold|Transaction has \d+ inputs and can have at most/;

// The fullnode facade's message for a token whose UTXOs don't cover what the send needs of it.
const INSUFFICIENT_TOKENS_ERROR = /^Token: (\w+)\. Insufficient amount of tokens to fill the amount\./;

// Translates wallet-lib error messages to user-friendly text. The UTXO
// patterns apply during build (auto-selection in prepare-tx); other errors
// (auth, signing, mining) fall through to the original lib message.
export function mapTxError(err) {
  // The errors of sends with private outputs, the ones where HTR is short of a privacy fee
  // included, come first.
  const shieldedCopy = mapShieldedSendError(err);
  if (shieldedCopy) {
    return shieldedCopy;
  }
  const msg = err?.message || '';
  const htrUid = hathorLib.constants.NATIVE_TOKEN_UID;
  if (msg.includes(`No UTXOs available for the token ${htrUid}`)) {
    return t`Insufficient HTR to cover the network fee.`;
  }
  if (msg.includes('No UTXOs available for the token')) {
    return t`Insufficient balance to send this transaction.`;
  }
  const insufficientTokens = INSUFFICIENT_TOKENS_ERROR.exec(msg);
  if (insufficientTokens) {
    // HTR pays the fees: for HTR, they count with the amount.
    return insufficientTokens[1] === htrUid
      ? t`Insufficient HTR to cover this transaction and its fees.`
      : t`Insufficient balance to send this transaction.`;
  }
  if (INPUT_LIMIT_ERROR.test(msg)) {
    return t`This amount needs more inputs than a transaction can hold. Try sending a smaller amount.`;
  }
  return msg || t`Failed to process transaction.`;
}

const SendConfirmScreen = () => {
  const tokensBalance = useSelector((state) => state.tokensBalance);
  const wallet = useSelector((state) => state.wallet);
  const useWalletService = useSelector((state) => state.useWalletService);
  const tokenMetadata = useSelector((state) => state.tokenMetadata);
  const isShowingPinScreen = useSelector((state) => state.isShowingPinScreen);
  const networkName = useSelector((state) => state.networkSettings.network);
  // A provider is registered only for seed wallets on the fullnode facade, on the shielded
  // testnet, whether or not the shielded UI shows.
  const providerReady = useSelector(
    (state) => state.shielded?.providerStatus === SHIELDED_PROVIDER_STATUS.READY,
  );
  // Whether the shielded UI shows: elsewhere the fees break down into the network fee alone.
  const showsPrivacyFee = useSelector(isShieldedEnvironment);

  const navigation = useNavigation();
  const params = useParams();

  // Parse and store navigation params
  const {
    amount,
    address,
    token,
    privacyMode = PRIVACY_MODE.PUBLIC,
  } = params;
  const isNFT = isTokenNFT(token.uid, tokenMetadata);
  const amountAndToken = `${renderValue(amount, isNFT)} ${token.symbol}`;

  const [phase, setPhase] = useState(PHASE.BUILDING);
  const [sendTx, setSendTx] = useState(null);
  // The fees of the prepared send: { total, network, privacy, privateOutputs }.
  const [fees, setFees] = useState(null);
  const [buildError, setBuildError] = useState(null);
  const [modal, setModal] = useState(null);
  const [isTooltipShown, setIsTooltipShown] = useState(false);
  // Whether the Fees row shows the network fee and the privacy fee it adds up.
  const [isFeesExpanded, setIsFeesExpanded] = useState(false);
  // Whether the sheet that explains the fees shows.
  const [isFeesInfoShown, setIsFeesInfoShown] = useState(false);
  // Disables the Send button from the moment it's tapped until the screen is
  // interactive again, closing the window between the PinScreen dismissal and
  // the feedback modal render where the button would otherwise be tappable.
  const [isSending, setIsSending] = useState(false);
  // Whether the screen left, for the steps of the build that outlive it.
  const unmountedRef = useRef(false);
  // Stops a wait for the wallet to be ready.
  const cancelWaitRef = useRef(null);
  // Whether the PIN screen of an unlock is open, which the locked modal would cover.
  const [isAskingForPin, setIsAskingForPin] = useState(false);

  const nativeSymbol = hathorLib.constants.DEFAULT_NATIVE_TOKEN_CONFIG.symbol;

  const failBuild = (message) => {
    setBuildError({ message });
    setPhase(PHASE.ERROR);
  };

  /**
   * Builds the send to its single output, without inputs: wallet-lib selects them, and on the
   * shielded testnet completes a private output and decides the change by its rules. This gives
   * the exact fee the user pays, shown before the user authorizes the send. A public output to a
   * private address pays the P2PKH address of its spend key.
   *
   * Where the shielded crypto provider is registered, the send is built with the wallet: it
   * waits for the wallet to be ready, which a reconnect or a decode walk delays, and once the
   * send is pushed the wallet decodes its own private change, if any, without waiting for the
   * node. Elsewhere it is built from the storage, as it always was.
   */
  const build = async () => {
    try {
      const shieldedMode = privacyModeToShieldedMode(privacyMode);

      let sendTransaction;
      if (useWalletService) {
        // The wallet-service facade has no private sends, and would pay a private address with
        // a script that no key can spend.
        if (shieldedMode !== null) {
          failBuild(t`Private transfers are not available for this wallet.`);
          return;
        }
        if (isShieldedAddress(address, new hathorLib.Network(networkName))) {
          failBuild(shieldedAddressNotSupportedText);
          return;
        }
        const outputs = [{ address, value: amount, token: token.uid }];
        sendTransaction = new hathorLib.SendTransactionWalletService(wallet, { outputs });
      } else {
        if (providerReady) {
          const wait = waitForWalletReady(wallet);
          cancelWaitRef.current = wait.cancel;
          const ready = await wait.promise;
          cancelWaitRef.current = null;
          if (!ready || unmountedRef.current) {
            return;
          }
        }
        if (shieldedMode !== null) {
          // A private send can spend the wallet's private outputs, and must decode its own
          // private change once it is sent: it needs the wallet at level full.
          const capability = await wallet.getShieldedCapability();
          if (unmountedRef.current) {
            return;
          }
          if (capability.level === 'watch' && capability.cause !== 'corrupt-key') {
            // A PIN can unlock it: the user can, and then the send is built.
            setPhase(PHASE.LOCKED);
            return;
          }
          if (capability.level !== 'full') {
            failBuild(t`Private transfers are not available for this wallet.`);
            return;
          }
        }
        const outputs = [buildSendOutput({
          address,
          amount,
          tokenUid: token.uid,
          shieldedMode,
        })];
        sendTransaction = providerReady
          ? new hathorLib.SendTransaction({ wallet, outputs })
          : new hathorLib.SendTransaction({ storage: wallet.storage, outputs });
      }

      await sendTransaction.run('prepare-tx');

      if (unmountedRef.current) {
        try { await sendTransaction.releaseUtxos(); } catch (e) { console.error(e); }
        return;
      }

      // From here on, the screen releases the send's UTXOs when it leaves.
      setSendTx(sendTransaction);
      setFees(computeSendFees(sendTransaction));
      setPhase(PHASE.READY);
    } catch (err) {
      if (unmountedRef.current) return;
      console.error(err);
      failBuild(mapTxError(err));
    }
  };

  /**
   * Unlocks the wallet's private balance with the PIN the user entered, waits until the wallet
   * decoded the private outputs it held locked, then builds the send. The PIN goes from the PIN
   * screen's callback to wallet-lib, and nowhere else.
   *
   * @param {string} pin The PIN, or the password that safe biometry keeps
   */
  const unlockAndBuild = async (pin) => {
    setIsAskingForPin(false);
    setPhase(PHASE.UNLOCKING);
    try {
      const result = await unlockShieldedViewIfLocked(wallet, pin);
      if (unmountedRef.current) {
        return;
      }
      if (result.status === SHIELDED_UNLOCK_STATUS.FAILED) {
        log.error('The private balance was not unlocked for a send.', { errorCode: result.errorCode });
        failBuild(t`Could not unlock your private balance.`);
        return;
      }
      if (result.status === SHIELDED_UNLOCK_STATUS.UNLOCKED) {
        // The walk that decodes the private outputs the wallet held locked; it never rejects.
        await result.reprocessed;
        if (unmountedRef.current) {
          return;
        }
      }
      setPhase(PHASE.BUILDING);
      await build();
    } catch (e) {
      if (unmountedRef.current) {
        return;
      }
      log.error('Failed to unlock the private balance for a send.', e);
      failBuild(t`Could not unlock your private balance.`);
    }
  };

  const askForUnlockPin = () => {
    // The PIN screen opens over this screen, whose modals would cover it.
    setIsAskingForPin(true);
    navigation.navigate('PinScreen', {
      cb: unlockAndBuild,
      canCancel: true,
      screenText: t`Enter your 6-digit pin to unlock your private balance`,
      biometryText: t`Unlock private balance`,
    });
  };

  // Build the transaction on mount.
  useEffect(() => {
    unmountedRef.current = false;
    build();

    return () => {
      unmountedRef.current = true;
      cancelWaitRef.current?.();
    };
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
      // The PIN screen of an unlock closed: if it was cancelled, the locked modal shows again.
      setIsAskingForPin(false);
    });

    return focusListener;
  }, [navigation]);

  // The whole fee of the send, once it is built. Over zero, the Fees row shows it and expands
  // into the network fee and the privacy fee; at zero, the Network Fee row says there is none.
  const networkFee = phase === PHASE.READY && fees ? fees.total : null;
  // How many shielded outputs the send has, each paying a privacy fee.
  const shieldedCount = fees?.privateOutputs ?? 0;
  // Where the shielded UI doesn't show, the privacy fee counts in the network fee.
  const privacyFee = showsPrivacyFee && fees ? fees.privacy : 0n;
  const networkOnlyFee = privacyFee > 0n ? fees.network : networkFee;

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
      // Re-mint a full token with the PIN. A passkey wallet has no PIN: its signing ceremony mints
      // the full token itself (see makePasskeyTxSigner onRootKey), so skip this without one.
      if (useWalletService && pin) {
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
    authorizeTransaction({
      navigation,
      // onPasskey defaults to pinParams.cb (executeSend) — both paths run the same function here.
      pinParams: {
        cb: executeSend,
        canCancel: true,
        screenText: t`Enter your 6-digit pin to authorize operation`,
        biometryText: t`Authorize operation`,
        biometryLoadingText: t`Building transaction`,
      },
    });
  };

  /**
   * Method executed after dismiss success modal
   */
  const exitScreen = () => {
    setModal(null);

    NavigationService.navigate('Main', { screen: 'Home' });

    // Reset the Send stack to its first screen, the address input, so the next send starts on
    // an empty form. Give enough time for the navigation to complete so the user doesn't see
    // the SendStack reseting.
    setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'SendAddressInput' }] });
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
          // The build waits for the wallet where a provider is registered, which can take a
          // while (a reconnect, a decode walk): the user can leave meanwhile.
          onDismiss={providerReady ? () => navigation.goBack() : undefined}
        />
      )}

      {phase === PHASE.LOCKED && !isAskingForPin && (
        <FeedbackModal
          text={t`Your private balance is locked. Unlock it to send privately.`}
          icon={<ShieldPadlockIcon size={64} color={COLORS.textColor} />}
          onDismiss={dismissBuildError}
          action={(
            <NewHathorButton title={t`Unlock private balance`} onPress={askForUnlockPin} />
          )}
        />
      )}

      {phase === PHASE.UNLOCKING && (
        <FeedbackModal
          text={t`Reading your private balance`}
          icon={<Spinner />}
          // Decoding the whole history can take a while: the user can leave meanwhile.
          onDismiss={dismissBuildError}
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
          onDismissError={() => {
            setModal(null);
            // Re-enable Send: the passkey flow never leaves this screen, so the
            // focus listener that resets it after PinScreen won't fire.
            setIsSending(false);
          }}
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

      {/* The sheet of the Fees row's info icon, which explains the network and privacy fees. */}
      <BackdropModal
        visible={isFeesInfoShown}
        onDismiss={() => setIsFeesInfoShown(false)}
        animationType='slide'
        position='bottom'
      >
        <View style={styles.feeInfoSheet}>
          <Text style={styles.feeInfoTitle}>{t`Transaction fees`}</Text>
          <Text style={styles.feeInfoBody}>
            {t`This transaction includes a network fee and additional privacy fees. Each shielded output incurs a separate privacy fee. Tap to see the breakdown.`}
          </Text>
        </View>
      </BackdropModal>

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
              <Text style={styles.summaryHeading}>{t`Transaction summary`}</Text>
              <View style={styles.summaryContainer}>
                {/* A hairline divides the recipient from the fees. */}
                <View style={[styles.summaryItem, styles.summaryItemDivider]}>
                  <Text style={styles.summaryLabel}>{t`To`}</Text>
                  <Text style={styles.summaryValue}>
                    {address.substr(0, 7)}...{address.substr(-7)}
                  </Text>
                </View>

                {/* A send with fees has a Fees row: a tap anywhere on it expands it into the
                    network fee and the privacy fee. A send without fees has a Network Fee row. */}
                {networkFee > 0n ? (
                  <>
                    <TouchableOpacity
                      style={styles.summaryItem}
                      onPress={() => setIsFeesExpanded((expanded) => !expanded)}
                      activeOpacity={0.6}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.summaryLabel}>{t`Fees`}</Text>
                        <TouchableOpacity
                          onPress={() => setIsFeesInfoShown(true)}
                          style={{ marginLeft: 6 }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <InfoCircleIcon size={16} />
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.summaryValue}>
                          {renderValue(networkFee, false)} {nativeSymbol}
                        </Text>
                        <View style={{ marginLeft: 6 }}>
                          {isFeesExpanded
                            ? <ChevronUpIcon size={16} color={COLORS.textColor} />
                            : <ChevronDownIcon size={16} color={COLORS.textColor} />}
                        </View>
                      </View>
                    </TouchableOpacity>

                    {isFeesExpanded && (
                      <>
                        {networkOnlyFee > 0n && (
                          <View style={styles.summarySubItem}>
                            <Text style={styles.summarySubLabel}>{t`Network fee`}</Text>
                            <Text style={styles.summarySubValue}>
                              {renderValue(networkOnlyFee, false)} {nativeSymbol}
                            </Text>
                          </View>
                        )}
                        {privacyFee > 0n && (
                          <View style={styles.summarySubItem}>
                            <Text style={styles.summarySubLabel}>
                              {ngettext(
                                msgid`Privacy fee (${shieldedCount} output)`,
                                `Privacy fee (${shieldedCount} outputs)`,
                                shieldedCount,
                              )}
                            </Text>
                            <Text style={styles.summarySubValue}>
                              {renderValue(privacyFee, false)} {nativeSymbol}
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <View style={styles.summaryItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.summaryLabel}>{t`Network Fee`}</Text>
                      <TouchableOpacity onPress={handleFeeInfoPress} style={{ marginLeft: 4 }}>
                        <InfoCircleIcon size={16} />
                      </TouchableOpacity>
                    </View>
                    {renderNetworkFeeValue()}
                  </View>
                )}

                <View style={[styles.summaryItem, styles.totalRow]}>
                  <Text style={styles.totalLabel}>{t`Total`}</Text>
                  <Text style={styles.totalValue}>
                    {`${amountAndToken}${networkFee > 0n ? ` + ${renderValue(networkFee, false)} ${nativeSymbol}` : ''}`}
                  </Text>
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
  // The heading of the summary, on the page above its card.
  summaryHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textColor,
    marginBottom: 10,
  },
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
    alignItems: 'center',
  },
  // The rows of the card have a muted label and a regular value; only the total is bold.
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.textColor,
  },
  summaryItemDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderColor,
  },
  // The fees the Fees row expands into: smaller, and muted on both sides.
  summarySubItem: {
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summarySubLabel: {
    fontSize: 13,
    color: COLORS.textColorShadow,
  },
  summarySubValue: {
    fontSize: 13,
    color: COLORS.textColorShadow,
  },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.borderColor,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textColor,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textColor,
  },
  nofee: {
    flexDirection: 'row',
    borderRadius: 10,
    paddingLeft: 5,
    paddingRight: 10,
    backgroundColor: '#EEFBEB',
    alignItems: 'center',
  },
  feeInfoSheet: {
    padding: 24,
    paddingBottom: 32,
    backgroundColor: COLORS.backgroundColor,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  feeInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textColor,
    marginBottom: 8,
  },
  feeInfoBody: {
    fontSize: 14,
    color: COLORS.textColor,
    lineHeight: 20,
  },
});

export default SendConfirmScreen;
