/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, Text, View } from 'react-native';
import { get } from 'lodash';
import { useSelector } from 'react-redux';
import { t, jt } from 'ttag';

import hathorLib from '@hathor/wallet-lib';
import AmountTextInput from '../components/AmountTextInput';
import HathorHeader from '../components/HathorHeader';
import InfoBox from '../components/InfoBox';
import InputLabel from '../components/InputLabel';
import NewHathorButton from '../components/NewHathorButton';
import OfflineBar from '../components/OfflineBar';
import { getKeyboardAvoidingViewTopDistance, Strong } from '../utils';
import { COLORS } from '../styles/themes';
import { useNavigation, useParams } from '../hooks/navigation';

/* global BigInt */

/**
 * This screen expects the following parameters on the navigation:
 * name {string} token name
 * symbol {string} token symbol
 */
const CreateTokenAmount = () => {
  const inputRef = useRef(null);
  const [amountText, setAmountText] = useState('');
  const [amount, setAmount] = useState(0n);
  const [deposit, setDeposit] = useState(0n);
  const [error, setError] = useState(null);
  const { wallet, decimalPlaces } = useSelector((state) => ({
    wallet: state.wallet,
    decimalPlaces: state.serverInfo?.decimal_places
  }));
  const navigation = useNavigation();
  const params = useParams();

  // Get route params with BigInt support
  const { name, symbol } = params;

  const nativeSymbol = wallet.storage.getNativeTokenData().symbol;

  // Get balance from Redux store
  const balance = useSelector((state) => get(
    state.tokensBalance,
    `[${hathorLib.constants.NATIVE_TOKEN_UID}].data`,
    {
      available: 0n,
      locked: 0n,
    }
  ));

  // Focus the input when the screen is focused
  useEffect(() => {
    const focusListener = navigation.addListener('focus', () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    });

    return focusListener;
  }, [navigation]);

  // Handle amount text change
  const onAmountChange = (text, value) => {
    setAmountText(text);

    try {
      if (value !== null) {
        setAmount(value);

        // Calculate deposit (1% of amount)
        const calculatedDeposit = value / BigInt(100);
        setDeposit(calculatedDeposit);

        setError(null);
      } else if (text) {
        // If text is not empty but no valid BigInt was provided, show error
        setAmount(0n);
        setDeposit(0n);
        setError(t`Invalid amount`);
      } else {
        // Text is empty
        setAmount(0n);
        setDeposit(0n);
        setError(null);
      }
    } catch (e) {
      // Handle any unexpected errors
      console.error('Error processing amount:', e);
      setAmount(0n);
      setDeposit(0n);
      setError(t`Invalid amount`);
    }
  };

  // Handle button press - BigInt values are automatically serialized
  const onButtonPress = () => {
    navigation.navigate('CreateTokenConfirm', {
      name: params.name,
      symbol: params.symbol,
      amount,
      deposit,
    });
  };

  // Check if the button should be disabled
  const isButtonDisabled = () => {
    if (!params.name || !params.symbol) {
      return true;
    }

    if (amount <= 0n) {
      return true;
    }

    if (deposit > balance.available) {
      return true;
    }

    return false;
  };

  // Determine style for amount display
  const getAmountStyle = () => {
    if (deposit > balance.available) {
      return { color: COLORS.errorTextColor };
    }
    return {};
  };

  const amountStyle = getAmountStyle();
  const amountAvailableText = (
    <Strong style={amountStyle}>
      {hathorLib.numberUtils.prettyValue(balance.available)} {nativeSymbol}
    </Strong>
  );

  return (
    <View style={{ flex: 1 }}>
      <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()}>
        <HathorHeader
          title={t`CREATE TOKEN`}
          onBackPress={() => navigation.goBack()}
          onCancel={() => navigation.getParent().goBack()}
        />
        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View style={{ marginTop: 24 }}>
              <InputLabel style={{ textAlign: 'center', marginBottom: 16 }}>
                {t`Amount of ${name} (${symbol})`}
              </InputLabel>
              <AmountTextInput
                ref={inputRef}
                autoFocus
                decimalPlaces={decimalPlaces}
                onAmountUpdate={onAmountChange}
                value={amountText}
              />
              {error && (
                <Text style={{ color: COLORS.errorTextColor, marginTop: 8, textAlign: 'center' }}>
                  {error}
                </Text>
              )}
            </View>
            <View>
              <InfoBox
                items={[
                  <Text key='deposit'>{t`Deposit:`} <Strong style={amountStyle}>
                    {hathorLib.numberUtils.prettyValue(deposit)} {nativeSymbol}
                  </Strong></Text>,
                  <Text key='available'>
                    {jt`You have ${amountAvailableText} ${nativeSymbol} available`}
                  </Text>
                ]}
              />
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
    </View>
  );
};

export default CreateTokenAmount;
