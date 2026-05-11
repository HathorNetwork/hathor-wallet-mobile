/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect } from 'react';
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
import BackdropModal from '../components/BackdropModal';
import SendTransactionFeedbackModal from '../components/SendTransactionFeedbackModal';
import TooltipModal from '../components/TooltipModal';
import { renderValue, isTokenNFT } from '../utils';
import NavigationService from '../NavigationService';
import { useNavigation, useParams } from '../hooks/navigation';
import { COLORS } from '../styles/themes';
import { InfoCircleIcon } from '../components/Icons/InfoCircle';
import { CheckIcon } from '../components/Icons/Check.icon';
import { ChevronDownIcon } from '../components/Icons/ChevronDown.icon';
import { ChevronUpIcon } from '../components/Icons/ChevronUp.icon';
import { TOKEN_DEPOSIT_URL, TOKEN_FEES_URL, PRIVACY_MODE } from '../constants';

/**
 * Per-tx privacy fees: every shielded tx produces exactly 2 shielded
 * outputs (recipient + change/synthetic 2nd) per protocol minimum.
 * The per-output fee is fetched from the wallet-lib constants so we
 * mirror the verifier's accepted values.
 */
const NUM_SHIELDED_OUTPUTS_PER_TX = 2n;
const FEE_PER_FS_OUTPUT = hathorLib.constants.FEE_PER_FULL_SHIELDED_OUTPUT;
const FEE_PER_AS_OUTPUT = hathorLib.constants.FEE_PER_AMOUNT_SHIELDED_OUTPUT;

/**
 * Build the output list (and the matching `changeShieldedMode`) for a
 * shielded send, using the same selection / split logic that
 * `executeSend` used historically. Pulled out so we can call it once at
 * mount time to pre-prepare the tx for the summary, then again is NOT
 * needed — the prepared `SendTransaction` is reused on confirm.
 *
 * For the public path the caller skips this and just emits a single
 * recipient output; no shielded change is involved.
 */
const buildShieldedOutputs = async ({ wallet, amount, address, token, privacyMode }) => {
  const { ShieldedOutputMode } = hathorLib.shielded;
  const shieldedMode = privacyMode === PRIVACY_MODE.HIDE_AMOUNT
    ? ShieldedOutputMode.AMOUNT_SHIELDED
    : ShieldedOutputMode.FULLY_SHIELDED;

  const feePerOutput = shieldedMode === ShieldedOutputMode.FULLY_SHIELDED
    ? FEE_PER_FS_OUTPUT
    : FEE_PER_AS_OUTPUT;
  const isHTR = token.uid === hathorLib.constants.NATIVE_TOKEN_UID;
  // Protocol minimum: 2 shielded outputs per tx.
  const totalFeeForSelection = feePerOutput * 2n;
  const utxoTarget = isHTR ? amount + totalFeeForSelection : amount;

  const { changeAmount } = await wallet.getUtxosForAmount(utxoTarget, { token: token.uid });

  let selfAddr;
  try {
    selfAddr = (await wallet.getCurrentAddress({}, { legacy: false })).address;
  } catch (e) {
    throw new Error(
      'Shielded addresses are not set up on this wallet. Reload the wallet '
      + '(Settings → Reset data) so shielded addresses can be derived, then retry the send.'
    );
  }

  let outputs;
  if (changeAmount > 0n) {
    outputs = [
      { address, value: amount, token: token.uid, shielded: shieldedMode },
      { address: selfAddr, value: changeAmount, token: token.uid, shielded: shieldedMode },
    ];
  } else if (amount > 1n) {
    outputs = [
      { address, value: amount - 1n, token: token.uid, shielded: shieldedMode },
      { address: selfAddr, value: 1n, token: token.uid, shielded: shieldedMode },
    ];
  } else {
    try {
      const larger = await wallet.getUtxosForAmount(utxoTarget + 1n, { token: token.uid });
      outputs = [
        { address, value: amount, token: token.uid, shielded: shieldedMode },
        {
          address: selfAddr,
          value: larger.changeAmount + 1n,
          token: token.uid,
          shielded: shieldedMode,
        },
      ];
    } catch (_e) {
      throw new Error(
        'Insufficient funds: shielded transactions require at least 2 outputs. '
        + 'You need more than 0.01 balance to send a shielded transaction.'
      );
    }
  }

  return { outputs, changeShieldedMode: shieldedMode };
};

/**
 * Read the actual fee breakdown off a prepared transaction. The
 * total comes from the typed `getFeeHeader()` accessor on the
 * `Transaction` model — only HTR (`tokenIndex === 0`) entries are
 * summed; any non-HTR fee entry indicates a malformed tx and we'd
 * rather know about it than silently include it. The privacy
 * portion is the sum of per-shielded-output fees, including the HTR
 * shielded change the wallet-lib auto-adds when `changeShieldedMode`
 * is set — that's the source of the fee bump the static "2 outputs"
 * estimate used to miss. Network fee is the residual.
 */
const computeFeesFromPreparedTx = (preparedTx, fullTxData) => {
  const feeHeader = preparedTx.getFeeHeader();
  if (feeHeader && feeHeader.entries.some((entry) => entry.tokenIndex !== 0)) {
    throw new Error('Unexpected fee entry with non-HTR token index');
  }
  const totalFee = feeHeader
    ? feeHeader.entries
      .filter((entry) => entry.tokenIndex === 0)
      .reduce((sum, entry) => sum + entry.amount, 0n)
    : 0n;
  let privacyFee = 0n;
  let shieldedCount = 0;
  for (const so of fullTxData?.shieldedOutputs ?? []) {
    shieldedCount += 1;
    if (so?.mode === 2) {
      privacyFee += FEE_PER_FS_OUTPUT;
    } else {
      privacyFee += FEE_PER_AS_OUTPUT;
    }
  }
  return {
    totalFee,
    privacyFee,
    networkOnlyFee: totalFee - privacyFee,
    shieldedCount,
  };
};

function NoFee() {
  return (
    <View style={styles.nofee}>
      <CheckIcon size={16} color='#2E701F' />
      <Text style={{ color: '#2E701F' }}>{t`No fee`}</Text>
    </View>
  );
}

const SendConfirmScreen = () => {
  const tokensBalance = useSelector((state) => state.tokensBalance);
  const wallet = useSelector((state) => state.wallet);
  const useWalletService = useSelector((state) => state.useWalletService);
  const tokenMetadata = useSelector((state) => state.tokenMetadata);
  const isShowingPinScreen = useSelector((state) => state.isShowingPinScreen);

  const navigation = useNavigation();
  const params = useParams();

  // Parse and store navigation params
  const { amount, address, token, networkFee, utxos, privacyMode } = params;
  const isNFT = isTokenNFT(token.uid, tokenMetadata);
  const amountAndToken = `${renderValue(amount, isNFT)} ${token.symbol}`;

  const [modal, setModal] = useState(null);
  const [isTooltipShown, setIsTooltipShown] = useState(false);
  const [isFeesExpanded, setIsFeesExpanded] = useState(false);
  const [isFeesInfoShown, setIsFeesInfoShown] = useState(false);

  // Pre-prepared transaction state. For shielded sends on the
  // full-node path, we run `prepareTxData()` at mount time so the
  // summary shows the *actual* fee — including the auto-added shielded
  // HTR change that bumps the shielded-output count from 2 to 3.
  // For non-shielded or wallet-service sends, prep is skipped and the
  // simple estimate from `params.networkFee` is used.
  const [prepState, setPrepState] = useState({ status: 'preparing' });

  const nativeSymbol = hathorLib.constants.DEFAULT_NATIVE_TOKEN_CONFIG.symbol;

  const isShieldedTx = privacyMode && privacyMode !== PRIVACY_MODE.PUBLIC;
  const shouldPreprepare = isShieldedTx && !useWalletService;

  const feePerShieldedOutput = privacyMode === PRIVACY_MODE.PRIVATE
    ? FEE_PER_FS_OUTPUT
    : FEE_PER_AS_OUTPUT;

  // Effective fee values for the summary — prefer the prepared tx's
  // accurate numbers; fall back to the upstream estimate when prep is
  // skipped (transparent send) or still in flight.
  let totalFee;
  let privacyFee;
  let networkOnlyFee;
  let shieldedCount;
  if (prepState.status === 'ready' && prepState.totalFee != null) {
    totalFee = prepState.totalFee;
    privacyFee = prepState.privacyFee;
    networkOnlyFee = prepState.networkOnlyFee;
    shieldedCount = prepState.shieldedCount;
  } else {
    totalFee = networkFee ?? 0n;
    privacyFee = isShieldedTx ? feePerShieldedOutput * NUM_SHIELDED_OUTPUTS_PER_TX : 0n;
    networkOnlyFee = totalFee - privacyFee;
    shieldedCount = isShieldedTx ? Number(NUM_SHIELDED_OUTPUTS_PER_TX) : 0;
  }

  useEffect(() => {
    if (!shouldPreprepare) {
      setPrepState({ status: 'ready' });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { outputs, changeShieldedMode } = await buildShieldedOutputs({
          wallet,
          amount,
          address,
          token,
          privacyMode,
        });
        // The PIN here is a stub that satisfies the wallet-lib's
        // PIN-required guard. Signing happens later via `signTx(pin)`,
        // which takes the user's actual PIN as a parameter — we never
        // mutate `sendTx.pin` directly.
        const sendTx = await wallet.sendManyOutputsSendTransaction(outputs, {
          pinCode: '__preview__',
          changeShieldedMode,
        });
        // `prepareTx()` is the expensive step (UTXO selection + fee
        // math + crypto for shielded outputs + Transaction model
        // construction + max-input/output validation). Calling it
        // now caches both `fullTxData` and the validated
        // `transaction` on `sendTx`, so the later `signTx(pin)` /
        // `runFromMining()` chain reuses both — the on-chain tx is
        // byte-for-byte the one we previewed.
        const preparedTx = await sendTx.prepareTx();
        if (cancelled) return;
        const fees = computeFeesFromPreparedTx(preparedTx, sendTx.fullTxData);
        setPrepState({ status: 'ready', sendTx, ...fees });
      } catch (e) {
        if (cancelled) return;
        // Classify known errors so the UI can surface a helpful
        // message instead of the raw lib text.
        let classified = e;
        if (e instanceof Error && e.message.includes('Insufficient amount of tokens')) {
          classified = new Error(
            t`Insufficient funds for this transfer. You don't have enough balance to cover the amount and fees.`
          );
        }
        // eslint-disable-next-line no-console
        console.log('[SEND] Pre-prepare failed:', e?.message ?? e);
        setPrepState({ status: 'error', error: classified });
      }
    })();
    return () => {
      cancelled = true;
    };
    // The screen receives its inputs via navigation params; they don't
    // change during the screen's lifetime, so we run this once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * In case we can prepare the data, open send tx feedback modal (while sending the tx)
   * Otherwise, show error
   *
   * @param {String} pin User PIN already validated
   */
  const executeSend = async (pin) => {
    // Inputs come from the UTXOs the user implicitly committed to on
    // SendAmountInput (master's pre-selection). Empty for the
    // transparent default path; the shielded paths re-pick UTXOs
    // inside `buildShieldedOutputs` and the lib's prepareTxData, so
    // these `inputs` only feed the public/wallet-service branches.
    const inputs = utxos
      ? utxos.map(({ txId, index }) => ({ txId, index }))
      : [];
    let sendTransaction;
    let runPromise;

    if (prepState.status === 'ready' && prepState.sendTx && !useWalletService) {
      // Shielded full-node path: reuse the SendTransaction we already
      // prepared at mount time. `signTx(pin)` consumes the cached
      // `transaction`; `runFromMining()` mines the signed tx and
      // pushes it. Both reuse the prepared state set during mount, so
      // the on-chain tx is byte-for-byte the one shown in the summary.
      sendTransaction = prepState.sendTx;
      sendTransaction.on('send-error', (msg) => {
        // eslint-disable-next-line no-console
        console.log('[SEND] send-error event:', msg);
      });
      sendTransaction.on('job-error', (msg) => {
        // eslint-disable-next-line no-console
        console.log('[SEND] job-error event:', msg);
      });
      // Sign synchronously here so a wrong-PIN error surfaces before
      // we hand the mining promise to the loading modal — the user
      // gets the error inline instead of after watching a spinner.
      await sendTransaction.signTx(pin);
      runPromise = sendTransaction.runFromMining();
    } else if (useWalletService) {
      // Wallet-service backend uses a different SendTransaction class
      // and doesn't share the pre-prepare path; build outputs and
      // construct the wallet-service-specific instance here.
      let outputs;
      if (isShieldedTx) {
        const built = await buildShieldedOutputs({
          wallet, amount, address, token, privacyMode,
        });
        outputs = built.outputs;
      } else {
        outputs = [{ address, value: amount, token: token.uid }];
      }
      await wallet.validateAndRenewAuthToken(pin);
      sendTransaction = new hathorLib.SendTransactionWalletService(wallet, {
        outputs,
        inputs,
        pin,
      });
      sendTransaction.on('send-error', (msg) => {
        // eslint-disable-next-line no-console
        console.log('[SEND] send-error event:', msg);
      });
      sendTransaction.on('job-error', (msg) => {
        // eslint-disable-next-line no-console
        console.log('[SEND] job-error event:', msg);
      });
      runPromise = sendTransaction.run();
    } else {
      // Public (transparent) full-node path: simple single-output send,
      // no pre-prepare needed. Pass `inputs` so the lib reuses the
      // user-committed UTXO selection from SendAmountInput.
      const outputs = [{ address, value: amount, token: token.uid }];
      try {
        sendTransaction = await wallet.sendManyOutputsSendTransaction(
          outputs,
          { pinCode: pin, changeShieldedMode: null, inputs }
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('[SEND] Error preparing tx:', e.message, e);
        throw e;
      }
      sendTransaction.on('send-error', (msg) => {
        // eslint-disable-next-line no-console
        console.log('[SEND] send-error event:', msg);
      });
      sendTransaction.on('job-error', (msg) => {
        // eslint-disable-next-line no-console
        console.log('[SEND] job-error event:', msg);
      });
      runPromise = sendTransaction.run();
    }

    const promise = runPromise.catch((e) => {
      // eslint-disable-next-line no-console
      console.log('[SEND] Error:', e.message);
      const axErr = e.cause || e;
      if (axErr.response) {
        // eslint-disable-next-line no-console
        console.log('[SEND] Response status:', axErr.response.status);
        // eslint-disable-next-line no-console
        console.log('[SEND] Response body:', JSON.stringify(axErr.response.data));
      }
      if (axErr.config) {
        // eslint-disable-next-line no-console
        console.log('[SEND] Request URL:', axErr.config.url);
        // eslint-disable-next-line no-console
        console.log('[SEND] Request data (first 200):', String(axErr.config.data).substring(0, 200));
      }
      throw e;
    });

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

    // The redesigned Send flow always starts on the manual address entry
    // screen — the QR scanner is now reachable from a top-right icon on
    // SendAddressInput, not the initial route. Reset the stack to that
    // screen so the next Send tap lands on a clean form.
    NavigationService.navigate('Main', { screen: 'Home' });
    setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'SendAddressInput' }] });
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
    if (privacyMode && privacyMode !== 'public' && networkFee > 0n) {
      return t`Shielded transactions include a per-output protocol fee, paid in HTR.`;
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
      )
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

      {/* "i" info popover for the expanded Fees row. Slides up from the
          bottom; tap-outside dismisses. Explains the Network/Privacy
          split shown in the row. */}
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
            <Text style={styles.summaryHeading}>{t`Transaction summary`}</Text>
            <View style={styles.summaryContainer}>
              {/* Recipient row: label muted, value in regular weight. The
                  hairline divider below it splits To from Fees per the
                  figma layout. */}
              <View style={[styles.summaryItem, styles.summaryItemDivider]}>
                <Text style={styles.summaryLabel}>{t`To`}</Text>
                <Text style={styles.summaryValue}>
                  {address.substr(0, 7)}...{address.substr(-7)}
                </Text>
              </View>

              {/* Fees row.
                  - When totalFee > 0:        single tappable "Fees" row with
                    the total + chevron; expands to show Network fee +
                    Privacy fee breakdown.
                  - When totalFee == 0:       single "Network Fee" row with
                    the green NoFee badge (no expansion, no info icon).
                  Per-row tap area covers the whole row, not just the
                  chevron, so the affordance is large and obvious. */}
              {totalFee > 0n ? (
                <>
                  <TouchableOpacity
                    style={styles.summaryItem}
                    onPress={() => setIsFeesExpanded((v) => !v)}
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
                        {renderValue(totalFee, false)} {nativeSymbol}
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
                              shieldedCount
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

              {/* Total row: both label and value bold per figma. */}
              <View style={[styles.summaryItem, styles.totalRow]}>
                <Text style={styles.totalLabel}>{t`Total`}</Text>
                <Text style={styles.totalValue}>
                  {`${amountAndToken}${totalFee > 0n ? ` + ${renderValue(totalFee, false)} ${nativeSymbol}` : ''}`}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <NewHathorButton
          title={prepState.status === 'preparing' ? t`Preparing…` : t`Send`}
          onPress={onSendPress}
          // disable while modal is visible, while we're still preparing
          // the shielded tx (so the user can't tap SEND before the fee
          // total settles), and on prep error (so we don't run a
          // half-built tx).
          disabled={
            modal !== null
            || prepState.status === 'preparing'
            || prepState.status === 'error'
          }
        />
      </View>
      <OfflineBar />
    </View>
  );
};

const styles = StyleSheet.create({
  // "Transaction summary" heading sits above the card per figma —
  // bold black on the page background, not inside the card.
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
  // Top-level rows (To, Fees, Network Fee): muted gray label, regular
  // black value — matches the figma summary card. Only the Total row
  // uses bold weight on both sides.
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.textColor,
  },
  // Hairline separator applied to rows that need a divider below them
  // (currently the To row, splitting recipient from fees per figma).
  summaryItemDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderColor,
  },
  // Breakdown rows under the expanded Fees: both sides muted, smaller
  // font so they read as supplementary detail.
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
  // Total row: separator above; both label and value bold black.
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
