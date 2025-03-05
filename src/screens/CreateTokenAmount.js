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
import { bigIntCoercibleSchema } from '@hathor/wallet-lib/lib/utils/bigint';
import AmountTextInput from '../components/AmountTextInput';
import HathorHeader from '../components/HathorHeader';
import InfoBox from '../components/InfoBox';
import InputLabel from '../components/InputLabel';
import NewHathorButton from '../components/NewHathorButton';
import OfflineBar from '../components/OfflineBar';
import { getIntegerAmount, getKeyboardAvoidingViewTopDistance, Strong } from '../utils';
import { COLORS } from '../styles/themes';

// Declare BigInt for ESLint
/* global BigInt */

/**
 * This screen expects the following parameters on the navigation:
 * name {string} token name
 * symbol {string} token symbol
 */
const CreateTokenAmount = (props) => {
  const inputRef = useRef(null);
  const [amountText, setAmountText] = useState('');
  const [amount, setAmount] = useState(bigIntCoercibleSchema.parse(0));
  const [deposit, setDeposit] = useState(bigIntCoercibleSchema.parse(0));
  const [error, setError] = useState(null);
  const wallet = useSelector((state) => state.wallet);

  const nativeSymbol = wallet.storage.getNativeTokenData().symbol;

  // Get balance from Redux store
  const balance = useSelector((state) => get(
    state.tokensBalance,
    `[${hathorLib.constants.NATIVE_TOKEN_UID}].data`,
    {
      available: bigIntCoercibleSchema.parse(0),
      locked: bigIntCoercibleSchema.parse(0),
    }
  ));

  // Get name and symbol from navigation params
  const { route, navigation } = props;
  const { name, symbol } = route.params;

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
  const onAmountChange = (text) => {
    setAmountText(text);

    try {
      // Convert to integer considering the decimal places
      const integerAmount = getIntegerAmount(text);
      // Parse to BigInt
      const parsedAmount = bigIntCoercibleSchema.parse(integerAmount);
      setAmount(parsedAmount);

      // Calculate deposit (1% of amount)
      const calculatedDeposit = parsedAmount / BigInt(100);
      setDeposit(calculatedDeposit);

      setError(null);
    } catch (e) {
      // If invalid input, set amount and deposit to 0
      setAmount(bigIntCoercibleSchema.parse(0));
      setDeposit(bigIntCoercibleSchema.parse(0));

      if (text) {
        setError(t`Invalid amount`);
      } else {
        setError(null);
      }
    }
  };

  // Handle button press
  const onButtonPress = () => {
    const { route, navigation } = props;

    navigation.navigate('CreateTokenConfirm', {
      name: route.params.name,
      symbol: route.params.symbol,
      amount,
      deposit,
    });
  };

  // Check if the button should be disabled
  const isButtonDisabled = () => {
    const { route } = props;

    if (!route.params.name || !route.params.symbol) {
      return true;
    }

    if (amount <= BigInt(0)) {
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
