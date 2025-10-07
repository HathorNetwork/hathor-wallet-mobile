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
import { t, ngettext, msgid } from 'ttag';
import { get } from 'lodash';

import { renderValue } from '../utils';
import NewHathorButton from '../components/NewHathorButton';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import TokenBox from '../components/TokenBox';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import { COLORS } from '../styles/themes';
import { useNavigation } from '../hooks/navigation';
import { tokenSwapSetInputTokenAmount, tokenSwapSetOutputTokenAmount } from '../actions';


const TokenSwap = () => {
  const dispatch = useDispatch();
  const tokensBalance = useSelector((state) => state.tokensBalance);

  const [inputTokenAmountStr, setInputTokenAmountStr] = useState();
  const [inputTokenAmount, setInputTokenAmount] = useState();

  const [outputTokenAmountStr, setOutputTokenAmountStr] = useState();
  const [outputTokenAmount, setOutputTokenAmount] = useState();

  const {
    inputToken,
    inputTokenAmount: reduxInputTokenAmount,
    outputToken,
    outputTokenAmount: reduxOutputTokenAmount,
  } = useSelector((state) => state.swapToken);
  const { decimalPlaces } = useSelector((state) => ({
    decimalPlaces: state.serverInfo?.decimal_places
  }));

  const navigation = useNavigation();

  function onInputAmountChange(text, value) {
    setInputTokenAmountStr(text);
    setInputTokenAmount(value);
    // setError(null);
    // dispatch event to update reduxInputTokenAmount
    // The event should also reset outputTokenAmount
    dispatch(tokenSwapSetInputTokenAmount(value));
  }

  function onOutputAmountChange(text, value) {
    setOutputTokenAmountStr(text);
    setOutputTokenAmount(value);
    // setError(null);
    // dispatch event to update reduxOutputTokenAmount
    // The event should also reset inputTokenAmount
    dispatch(tokenSwapSetOutputTokenAmount(value));
  }


  const onInputTokenBoxPress = () => {
    navigation.navigate('TokenSwapInputTokenList', { token: inputToken.uid });
  };

  const onOutputTokenBoxPress = () => {
    navigation.navigate('TokenSwapOutputTokenList', { token: outputToken.uid });
  };

  const isButtonDisabled = () => {
    // Check other things?
    // input and output should not be 0n
    return (!inputTokenAmountStr || !inputTokenAmount || inputTokenAmount === 0n || !outputTokenAmountStr || !outputTokenAmount || outputTokenAmount === 0n)
  };

  const renderGhostElement = () => (
    <View style={{ width: 80, height: 40 }} />
  );

  const getAvailableString = (token) => {
    const balance = get(tokensBalance, `${token.uid}.data`, {
      available: 0n,
      locked: 0n,
    });
    const { available } = balance;
    const amountAndToken = `${renderValue(available, isNFT())} ${token.symbol}`;
    const availableCount = Number(available);
    return ngettext(msgid`${amountAndToken} available`, `${amountAndToken} available`, availableCount);
  };

  return (
    <View style={{ flex: 1 }}>
      <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()}>
        <HathorHeader
          withBorder
          title={t`TOKEN SWAP`}
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
                  onAmountUpdate={onInputAmountChange}
                  onEndEditing={onInputAmountEndEditing}
                  value={inputTokenAmountStr}
                  allowOnlyInteger={false}
                  decimalPlaces={decimalPlaces}
                  style={{ flex: 1 }} // we need this so the placeholder doesn't break in android
                  // devices after erasing the text
                  // https://github.com/facebook/react-native/issues/30666
                />
                <TokenBox onPress={onInputTokenBoxPress} label={inputToken.symbol} />
              </View>
              <InputLabel style={{ textAlign: 'center', marginTop: 8 }}>
                {getAvailableString(inputToken)}
              </InputLabel>
            </View>

            <View>
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 40,
              }}
              >
                {renderGhostElement()}
                <AmountTextInput
                  onAmountUpdate={onOutputAmountChange}
                  onEndEditing={onOutputEndEditing}
                  value={outputTokenAmountStr}
                  allowOnlyInteger={false}
                  decimalPlaces={decimalPlaces}
                  style={{ flex: 1 }} // we need this so the placeholder doesn't break in android
                  // devices after erasing the text
                  // https://github.com/facebook/react-native/issues/30666
                />
                <TokenBox onPress={onOutputTokenBoxPress} label={outputToken.symbol} />
              </View>
              <InputLabel style={{ textAlign: 'center', marginTop: 8 }}>
                {getAvailableString(outputToken)}
              </InputLabel>
            </View>

            <NewHathorButton
              title={t`Next`}
              disabled={isButtonDisabled()}
              onPress={onButtonPress}
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
});

export default TokenSwap;
