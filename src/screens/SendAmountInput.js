/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Network } from '@hathor/wallet-lib';

import { IS_MULTI_TOKEN, PRIVACY_MODE } from '../constants';
import { renderValue, isTokenNFT, isShieldedAddress } from '../utils';
import NewHathorButton from '../components/NewHathorButton';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import TokenBox from '../components/TokenBox';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import PrivacyModeSelector from '../components/PrivacyModeSelector';
import TransactionPrivacyModal from '../components/TransactionPrivacyModal';
import ShieldedUnlockAction from '../components/Shielded/ShieldedUnlockAction';
import { lockedCountText } from '../components/Shielded/ShieldedBalanceSplit';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';
import { COLORS } from '../styles/themes';
import { useNavigation, useParams } from '../hooks/navigation';
import { canSendPrivately, selectShieldedCapability } from '../shielded/gating';
import { isShieldedUnlockInProgress, selectShieldedUnlock } from '../shielded/unlockState';
import {
  MAX_PRIVATE_AMOUNT,
  getPrivacyModeOptions,
  initialPrivacyMode,
  isPrivateAmountAllowed,
} from '../utils/shieldedSend';

const SendAmountInput = () => {
  const selectedToken = useSelector((state) => state.selectedToken);
  const tokensBalance = useSelector((state) => state.tokensBalance);
  const tokenMetadata = useSelector((state) => state.tokenMetadata);
  const { decimalPlaces } = useSelector((state) => ({
    decimalPlaces: state.serverInfo?.decimal_places
  }));
  const privateSendsAvailable = useSelector(canSendPrivately);
  const capability = useSelector(selectShieldedCapability);
  const unlock = useSelector(selectShieldedUnlock);
  const networkName = useSelector((state) => state.networkSettings.network);

  const navigation = useNavigation();
  const params = useParams();

  const [amount, setAmount] = useState('');
  const [amountValue, setAmountValue] = useState(null);
  const [token, setToken] = useState(selectedToken);
  const [error, setError] = useState(null);
  // The mode the user picked in the privacy sheet, if any.
  const [chosenPrivacyMode, setChosenPrivacyMode] = useState(null);
  const [isPrivacyModalShown, setIsPrivacyModalShown] = useState(false);
  const inputRef = useRef(null);

  // The recipient decides the privacy modes. The send address input validated it, so it
  // parses; should the check fail anyway, the recipient is taken as public, and the send
  // confirmation, which checks it again, refuses to pay it.
  const recipientIsShielded = useMemo(() => {
    try {
      return isShieldedAddress(params.address, new Network(networkName));
    } catch (e) {
      return false;
    }
  }, [params.address, networkName]);
  const privacyOptions = getPrivacyModeOptions(recipientIsShielded);
  let privacyMode = PRIVACY_MODE.PUBLIC;
  if (privateSendsAvailable) {
    privacyMode = privacyOptions.includes(chosenPrivacyMode)
      ? chosenPrivacyMode
      : initialPrivacyMode(privacyOptions);
  }

  // The available balance leaves out the private outputs the wallet holds locked. Where a PIN
  // can unlock them (private sends are available at level watch only then), the screen says how
  // many there are and offers the unlock, which reads the balance again once they are decoded.
  // A spinner stands in for it while an unlock runs.
  const lockedCount = privateSendsAvailable && capability?.level === 'watch'
    ? capability.undecoded.locked
    : 0;
  const showsUnlock = privateSendsAvailable
    && (lockedCount > 0 || isShieldedUnlockInProgress(unlock));

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

    if (privacyMode !== PRIVACY_MODE.PUBLIC && !isPrivateAmountAllowed(amountValue)) {
      const max = renderValue(MAX_PRIVATE_AMOUNT, isNFT(), decimalPlaces);
      const { symbol } = token;
      setError(t`A private send can be at most ${max} ${symbol}.`);
      return;
    }

    const { address } = params;
    navigation.navigate('SendConfirmScreen', {
      address,
      amount: amountValue,
      token,
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
              {lockedCount > 0 && (
                <Text style={styles.hint}>{lockedCountText(lockedCount)}</Text>
              )}
              {showsUnlock && <ShieldedUnlockAction navigation={navigation} />}
              <Text style={styles.error}>{error}</Text>
            </View>
            <View>
              {privateSendsAvailable && (
                <PrivacyModeSelector
                  mode={privacyMode}
                  disabled={!recipientIsShielded}
                  onPress={() => setIsPrivacyModalShown(true)}
                />
              )}
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
      {privateSendsAvailable && (
        <TransactionPrivacyModal
          visible={isPrivacyModalShown}
          onDismiss={() => setIsPrivacyModalShown(false)}
          selectedMode={privacyMode}
          options={privacyOptions}
          onConfirm={(mode) => {
            setChosenPrivacyMode(mode);
            setIsPrivacyModalShown(false);
            setError(null);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  hint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    color: COLORS.textColorShadow,
  },
  error: {
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
    color: COLORS.errorTextColor,
  },
});

export default SendAmountInput;
