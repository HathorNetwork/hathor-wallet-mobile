/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { t, ngettext, msgid } from 'ttag';
import { get } from 'lodash';
import hathorLib, { TokenVersion } from '@hathor/wallet-lib';

import {
  IS_MULTI_TOKEN,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  FEATURE_TOGGLE_DEFAULTS,
  DEFAULT_PRIVACY_MODE,
} from '../constants';
import { renderValue, isTokenNFT } from '../utils';
import NewHathorButton from '../components/NewHathorButton';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import TokenBox from '../components/TokenBox';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import TransactionPrivacyModal from '../components/TransactionPrivacyModal';
import { ShieldPadlockIcon } from '../components/Icons/ShieldPadlock.icon';
import { EyeOffSlashIcon } from '../components/Icons/EyeOffSlash.icon';
import { EyeIcon } from '../components/Icons/Eye.icon';
import { ChevronDownIcon } from '../components/Icons/ChevronDown.icon';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';
import { COLORS } from '../styles/themes';
import { useNavigation, useParams } from '../hooks/navigation';

const SendAmountInput = () => {
  const wallet = useSelector((state) => state.wallet);
  const selectedToken = useSelector((state) => state.selectedToken);
  const tokensBalance = useSelector((state) => state.tokensBalance);
  const tokenMetadata = useSelector((state) => state.tokenMetadata);
  const { decimalPlaces } = useSelector((state) => ({
    decimalPlaces: state.serverInfo?.decimal_places
  }));
  const shieldedEnabled = useSelector(
    (state) => state.featureToggles[SHIELDED_OUTPUTS_FEATURE_TOGGLE]
      ?? FEATURE_TOGGLE_DEFAULTS[SHIELDED_OUTPUTS_FEATURE_TOGGLE]
  );
  // User's persisted default privacy mode, hydrated by the
  // privacyDefaultModeLoad saga on wallet start. Falls back to the
  // public default before the load saga settles.
  const privacyDefaultMode = useSelector(
    (state) => state.privacyDefaultMode ?? DEFAULT_PRIVACY_MODE
  );

  const navigation = useNavigation();
  const params = useParams();

  const [amount, setAmount] = useState('');
  const [amountValue, setAmountValue] = useState(null);
  const [token, setToken] = useState(selectedToken);
  const [error, setError] = useState(null);
  const [networkFee, setNetworkFee] = useState(null);
  const [utxos, setUtxos] = useState(null);
  // Initialise from the persisted default; the per-tx Privacy modal
  // overrides this for the current send only.
  const [privacyMode, setPrivacyMode] = useState(privacyDefaultMode);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const focusEvent = navigation.addListener('focus', () => {
      focusInput();
    });

    return () => {
      focusEvent();
    };
  }, [navigation]);

  useEffect(() => {
    setToken(selectedToken);
  }, [selectedToken]);

  useEffect(() => {
    let cancelled = false;

    // Per-shielded-output protocol fee, paid in HTR regardless of the token being sent.
    // Protocol requires a minimum of 2 shielded outputs per tx (see sendTransaction.ts
    // in wallet-lib), so shielded fee is always perOutput * 2 here. Transparent txs
    // pay 0.
    const shieldedFeeForTx = () => {
      if (privacyMode === 'hide_amount') {
        return hathorLib.constants.FEE_PER_AMOUNT_SHIELDED_OUTPUT * 2n;
      }
      if (privacyMode === 'private') {
        return hathorLib.constants.FEE_PER_FULL_SHIELDED_OUTPUT * 2n;
      }
      return 0n;
    };

    const calculateNetworkFee = async () => {
      const shieldedFee = shieldedFeeForTx();

      // Non-FEE tokens (HTR / deposit tokens) only pay the shielded fee, if any.
      if (token.version !== TokenVersion.FEE) {
        setNetworkFee(shieldedFee);
        return;
      }

      if (amountValue == null || amountValue <= 0n) {
        setNetworkFee(null);
        return;
      }

      // Set to null while calculating to indicate loading state
      setNetworkFee(null);
      setUtxos(null);

      try {
        const { utxos: selectedUtxos, changeAmount } = await wallet.getUtxosForAmount(
          amountValue,
          { token: token.uid }
        );
        if (cancelled) return;

        // Master pre-selects UTXOs on this screen so the eventual
        // SendTransaction reuses them as `inputs`. We keep that
        // behavior for the transparent path; shielded paths re-pick
        // UTXOs inside buildShieldedOutputs because the lib needs to
        // see them at the right point in prepareTxData.
        setUtxos(selectedUtxos);

        // Shielded mode always has >= 2 outputs; transparent has 1 or 2
        // depending on change. shieldedFee covers the per-shielded-output
        // privacy fees on top of the per-output network fee.
        const tokenFeeMultiplier = privacyMode !== 'public' || changeAmount ? 2n : 1n;
        setNetworkFee(tokenFeeMultiplier * hathorLib.constants.FEE_PER_OUTPUT + shieldedFee);
      } catch (err) {
        if (!cancelled) {
          const tokenFeeMultiplier = privacyMode !== 'public' ? 2n : 1n;
          setNetworkFee(tokenFeeMultiplier * hathorLib.constants.FEE_PER_OUTPUT + shieldedFee);
        }
      }
    };

    calculateNetworkFee();
    return () => { cancelled = true; };
  }, [wallet, token.uid, token.version, amountValue, privacyMode]);

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const onAmountChange = (text, value) => {
    setAmount(text);
    setAmountValue(value);
    setError(null);
  };

  const onTokenBoxPress = () => {
    navigation.navigate('ChangeToken', { token });
  };

  const onButtonPress = () => {
    const balance = get(tokensBalance, token.uid, {
      data: {
        available: 0n,
        locked: 0n,
      },
      status: TOKEN_DOWNLOAD_STATUS.LOADING,
    });
    const { available } = balance.data;

    if (!amountValue) {
      setError(t`Invalid amount`);
      return;
    }

    if (available < amountValue) {
      setError(t`Insufficient funds`);
      return;
    }

    // Guard: shielded privacy modes (Private / Hide amount) require a
    // shielded recipient address — the wallet needs the recipient's
    // scan pubkey (encoded only in the shielded address format) to
    // build the asset_commitment / amount_commitment. A regular P2PKH
    // address can only receive transparent (Public) sends. Surface the
    // mismatch up-front so the user can either change the address or
    // switch the per-tx privacy mode.
    if (privacyMode !== 'public' && params?.address) {
      try {
        const network = wallet?.getNetworkObject();
        if (network) {
          const addrObj = new hathorLib.Address(params.address, { network });
          if (!addrObj.isShielded()) {
            setError(
              t`The selected privacy mode requires a shielded address as the recipient. The address you entered is not shielded — change the address or switch to Public.`
            );
            return;
          }
        }
      } catch (_e) {
        // Address validation should have caught this on the previous
        // screen; defensively swallow and let the downstream send fail
        // with the canonical error if it didn't.
      }
    }

    // Guard against stale/unknown fee when we expect one (FEE token or shielded tx).
    const expectsFee = token.version === TokenVersion.FEE || privacyMode !== 'public';
    if (expectsFee && networkFee == null) {
      setError(t`Calculating network fee...`);
      return;
    }

    if (token.version === TokenVersion.FEE) {
      // For fee-based tokens the fee is charged in HTR, so check HTR balance covers it.
      const htrBalance = get(tokensBalance, hathorLib.constants.NATIVE_TOKEN_UID);
      if (!htrBalance) {
        setError(t`Insufficient balance of HTR to cover the network fee.`);
        return;
      }
      const { available: htrAvailable } = htrBalance.data;
      if (networkFee > htrAvailable) {
        setError(t`Insufficient balance of HTR to cover the network fee.`);
        return;
      }
    } else if (privacyMode !== 'public' && networkFee > 0n) {
      // Shielded tx on a non-fee token: fee is paid in HTR from a separate UTXO
      // (for custom tokens) or from the same HTR UTXOs as the amount (for HTR itself).
      const isHTR = token.uid === hathorLib.constants.NATIVE_TOKEN_UID;
      const htrBalance = get(tokensBalance, hathorLib.constants.NATIVE_TOKEN_UID);
      const htrAvailable = htrBalance?.data?.available ?? 0n;
      const required = isHTR ? amountValue + networkFee : networkFee;
      if (htrAvailable < required) {
        setError(t`Insufficient HTR balance to cover the shielded transaction fee.`);
        return;
      }
    }

    const { address } = params;
    navigation.navigate('SendConfirmScreen', {
      address,
      amount: amountValue,
      token,
      networkFee,
      utxos,
      privacyMode,
    });
  };

  const isButtonDisabled = () => (
    !amount
    || !amountValue
    || amountValue === 0n
  );

  const isNFT = () => (
    isTokenNFT(get(token, 'uid'), tokenMetadata)
  );

  const getAvailableString = () => {
    const balance = get(tokensBalance, `${token.uid}.data`, {
      available: 0n,
      locked: 0n,
    });
    const { available } = balance;
    const amountAndToken = `${renderValue(available, isNFT())} ${token.symbol}`;
    const availableCount = Number(available);
    return ngettext(msgid`${amountAndToken} available`, `${amountAndToken} available`, availableCount);
  };

  const renderGhostElement = () => (
    <View style={{ width: 80, height: 40 }} />
  );

  const tokenNameUpperCase = token.name.toUpperCase();

  return (
    <View style={{ flex: 1 }}>
      <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()}>
        <HathorHeader
          withBorder
          title={t`SEND ${tokenNameUpperCase}`}
          onBackPress={() => navigation.goBack()}
        />
        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getStatusBarHeight()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View>
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 40,
              }}
              >
                {renderGhostElement()}
                <AmountTextInput
                  ref={inputRef}
                  autoFocus
                  onAmountUpdate={onAmountChange}
                  value={amount}
                  allowOnlyInteger={isNFT()}
                  decimalPlaces={decimalPlaces}
                  style={{ flex: 1 }} // we need this so the placeholder doesn't break in android
                // devices after erasing the text
                // https://github.com/facebook/react-native/issues/30666
                />
                {IS_MULTI_TOKEN
                  ? <TokenBox onPress={onTokenBoxPress} label={token.symbol} />
                  : renderGhostElement()}
              </View>
              <InputLabel style={{ textAlign: 'center', marginTop: 8 }}>
                {getAvailableString()}
              </InputLabel>
              <Text style={styles.error}>{error}</Text>
            </View>
            <View>
              {shieldedEnabled && (() => {
                // Pick icon + labels for the current privacy mode so the
                // selector card matches the active row in the per-tx
                // privacy modal. Same SVG components and copy used
                // there, kept centralised so future label tweaks only
                // happen in one place.
                let ModeIcon;
                let modeTitle;
                let modeSubtitle;
                if (privacyMode === 'private') {
                  ModeIcon = ShieldPadlockIcon;
                  modeTitle = t`Private`;
                  modeSubtitle = t`Token and amount hidden`;
                } else if (privacyMode === 'hide_amount') {
                  ModeIcon = EyeOffSlashIcon;
                  modeTitle = t`Hide amount`;
                  modeSubtitle = t`Token visible, amount hidden`;
                } else {
                  ModeIcon = EyeIcon;
                  modeTitle = t`Public`;
                  modeSubtitle = t`Token and amount visible`;
                }
                return (
                  <Pressable
                    style={styles.privacyCard}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowPrivacyModal(true);
                    }}
                  >
                    <View style={styles.privacyCardLeft}>
                      <ModeIcon size={28} color={COLORS.textColor} />
                      <View style={styles.privacyCardText}>
                        <Text style={styles.privacyCardTitle}>{modeTitle}</Text>
                        <Text style={styles.privacyCardSubtitle}>{modeSubtitle}</Text>
                      </View>
                    </View>
                    <ChevronDownIcon size={20} color={COLORS.textColorShadow} />
                  </Pressable>
                );
              })()}
              <NewHathorButton
                title={t`Next`}
                disabled={isButtonDisabled()}
                onPress={onButtonPress}
              />
            </View>
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </Pressable>
      {shieldedEnabled && (
        <TransactionPrivacyModal
          visible={showPrivacyModal}
          onDismiss={() => setShowPrivacyModal(false)}
          selectedMode={privacyMode}
          onConfirm={(mode) => {
            setPrivacyMode(mode);
            setShowPrivacyModal(false);
          }}
        />
      )}
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
  // Privacy-mode selector card (figma layout panel):
  //   bg #FFFFFF, border 1px #E5E7EB, radius 16, padding 16/16/12/16,
  //   gap 16. Tappable; opens the Transaction Privacy modal.
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 16,
    marginBottom: 16,
  },
  privacyCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  privacyCardText: {
    flex: 1,
  },
  privacyCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textColor,
  },
  privacyCardSubtitle: {
    fontSize: 12,
    color: COLORS.textColorShadow,
    marginTop: 4,
  },
});

export default SendAmountInput;
