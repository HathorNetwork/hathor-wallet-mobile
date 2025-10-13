/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { numberUtils } from '@hathor/wallet-lib';
import React, { useState, useEffect } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { SwapIcon } from '../components/Icons/Swap.icon';
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
import {
  tokenSwapSetInputToken,
  tokenSwapSetOutputToken,
  tokenSwapSwitchTokens,
} from '../actions';


const SwapDivider = ({ onPress }) => {
  return (
    <View style={styles.dividerContainer}>
      <View style={styles.dividerLine} />
        <TouchableOpacity style={styles.dividerButton} onPress={onPress}>
          <SwapIcon color={COLORS.white} />
        </TouchableOpacity>
      <View style={styles.dividerLine} />
    </View>
  );
};

const TokenSwap = () => {
  const dispatch = useDispatch();
  const tokensBalance = useSelector((state) => state.tokensBalance);

  const [inputTokenAmountStr, setInputTokenAmountStr] = useState('0');
  const [inputTokenAmount, setInputTokenAmount] = useState(0n);

  const [outputTokenAmountStr, setOutputTokenAmountStr] = useState('0');
  const [outputTokenAmount, setOutputTokenAmount] = useState(0n);

  const [swapDirection, setSwapDirection] = useState(null);

  // XXX: this is a mock value to simulate fetching and showing the quote section
  const [showQuote, setShowQuote] = useState(false);

  const {
    allowedTokens,
    inputToken,
    outputToken,
  } = useSelector((state) => state.tokenSwap);
  const { decimalPlaces } = useSelector((state) => ({
    decimalPlaces: state.serverInfo?.decimal_places
  }));

  const navigation = useNavigation();

  useEffect(() => {
    if (!inputToken) {
      dispatch(tokenSwapSetInputToken(allowedTokens[0]));
      return;
    }
  }, [inputToken]);

  useEffect(() => {
    if (!outputToken) {
      dispatch(tokenSwapSetOutputToken(allowedTokens[0]));
      return;
    }
  }, [outputToken]);

  function onInputAmountChange(text, value) {
    setInputTokenAmountStr(text);
    setInputTokenAmount(value);
  }

  function onInputAmountEndEditing(_target) {
    console.log(`User added ${inputTokenAmount} tokens on input`);
    setOutputTokenAmountStr('0');
    setOutputTokenAmount(0n);
    setSwapDirection('input');

    // XXX here we should fetch the quote, but we will mock for now
    setShowQuote(true);
    setOutputTokenAmountStr('6.41');
    setOutputTokenAmount(641n);
  }

  function onOutputAmountEndEditing(_target) {
    console.log(`User added ${outputTokenAmount} tokens on output`);
    setInputTokenAmountStr('0');
    setInputTokenAmount(0n);
    setSwapDirection('output');

    // XXX here we should fetch the quote, but we will mock for now
    setShowQuote(true);
    setInputTokenAmountStr('6.41');
    setInputTokenAmount(641n);
  }

  function onOutputAmountChange(text, value) {
    setOutputTokenAmountStr(text);
    setOutputTokenAmount(value);
  }

  function onFocus() {
    setShowQuote(false);
  }

  const onInputTokenBoxPress = () => {
    navigation.navigate('TokenSwapListInputToken', { token: inputToken });
  };

  const onOutputTokenBoxPress = () => {
    navigation.navigate('TokenSwapListOutputToken', { token: outputToken });
  };

  const switchTokens = () => {

    const newOutputStr = inputTokenAmountStr;
    const newOutput = inputTokenAmount;
    const newInputStr = outputTokenAmountStr;
    const newInput = outputTokenAmount;

    // Also switch the direction of the swap
    if (swapDirection === 'input') {
      setInputTokenAmountStr(newInputStr);
      setInputTokenAmount(newInput);

      setOutputTokenAmountStr('0');
      setOutputTokenAmount(0n);

      setSwapDirection('output');
    } else if (swapDirection === 'output') {
      setOutputTokenAmountStr(newOutputStr);
      setOutputTokenAmount(newOutput);

      setInputTokenAmountStr('0');
      setInputTokenAmount(0n);

      setSwapDirection('input');
    }

    // switch the tokens being swapped
    dispatch(tokenSwapSwitchTokens());
  };

  const isButtonDisabled = () => {
    return (
      !inputTokenAmountStr
      || !inputTokenAmount
      || inputTokenAmount === 0n
      || !outputTokenAmountStr
      || !outputTokenAmount
      || outputTokenAmount === 0n
    );
  };

  const renderGhostElement = () => (
    <View style={{ width: 80, height: 40 }} />
  );

  const getAvailableString = (token) => {
    if (!token) {
      return;
    }
    const balance = get(tokensBalance, `${token.uid}.data`, {
      available: 0n,
      locked: 0n,
    });
    const { available } = balance;
    const amount = `${renderValue(available, false)}`;
    return t`Balance: ${amount}`;
  };

  const onButtonPress = () => {
    navigation.navigate('TokenSwapReview', {
      inputToken,
      inputAmount: inputTokenAmount,
      outputToken,
      outputAmount: outputTokenAmount,
      swapDirection,
    });
  };

  return (
    <View style={styles.screenContent}>
      <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()}>
        <HathorHeader
          withBorder
          title={t`TOKEN SWAP`}
          onBackPress={() => navigation.goBack()}
        />
        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getStatusBarHeight()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View>
              <View style={styles.card}>
                <View style={styles.tokenCard}>
                  {renderGhostElement()}
                  <AmountTextInput
                    onAmountUpdate={onInputAmountChange}
                    onEndEditing={onInputAmountEndEditing}
                    onFocus={onFocus}
                    value={inputTokenAmountStr}
                    allowOnlyInteger={false}
                    decimalPlaces={decimalPlaces}
                    style={styles.amountInputText}
                  />
                  <View>
                    <View style={styles.tokenSelectorWrapper}>
                      { inputToken ? (
                        <TokenBox onPress={onInputTokenBoxPress} label={inputToken.symbol} />
                      ) : (
                        <TokenBox label={""} />
                      )}
                    </View>
                    <InputLabel style={styles.amountAvailable}>
                      {getAvailableString(inputToken)}
                    </InputLabel>
                  </View>
                </View>
              </View>

              <SwapDivider onPress={switchTokens} />

              <View style={styles.card}>
                <View style={styles.tokenCard}>
                  {renderGhostElement()}
                  <AmountTextInput
                    onAmountUpdate={onOutputAmountChange}
                    onEndEditing={onOutputAmountEndEditing}
                    onFocus={onFocus}
                    value={outputTokenAmountStr}
                    allowOnlyInteger={false}
                    decimalPlaces={decimalPlaces}
                    style={styles.amountInputText}
                  />
                  <View>
                    <View style={styles.tokenSelectorWrapper}>
                      { outputToken ? (
                        <TokenBox onPress={onOutputTokenBoxPress} label={outputToken.symbol} />
                      ) : (
                        <TokenBox label={""} />
                      )}
                    </View>
                    <InputLabel style={styles.amountAvailable}>
                      {getAvailableString(outputToken)}
                    </InputLabel>
                  </View>
                </View>
              </View>

              { showQuote && (
                <View style={styles.quoteContainer}>
                  <View style={styles.quoteRow}>
                    <Text style={styles.quoteHeader}>{"Conversion rate"}</Text>
                    <Text style={styles.quoteValue}>{"15.60 HTR = 1 CTHOR"}</Text>
                  </View>
                  <View style={styles.quoteRow}>
                    <Text style={styles.quoteHeader}>{"Slippage"}</Text>
                    <Text style={styles.quoteValue}>{"0.5%"}</Text>
                  </View>
                  <View style={styles.quoteRow}>
                    <Text style={styles.quoteHeader}>{"Price impact"}</Text>
                    <Text style={styles.quoteValue}>{"-0.4%"}</Text>
                  </View>
                  <View style={styles.quoteRow}>
                    <Text style={styles.quoteHeader}>{"Minimum received"}</Text>
                    <Text style={styles.quoteValue}>{"6.41 CTHOR"}</Text>
                  </View>
                </View>
              )}
            </View>


            <NewHathorButton
              title={t`REVIEW`}
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
  screenContent: {
    flex: 1,
    backgroundColor: COLORS.lowContrastDetail,
  },
  tokenSelectorWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  amountAvailable: {
    marginTop: 8,
    marginBottom: 4,
  },
  amountInputText: { // https://github.com/facebook/react-native/issues/30666
    flex: 1,
    alignText: 'center',
    marginBottom: 30,
  },
  tokenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 30,
    padding: 8,
  },
  card: {
    zIndex: 1,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundColor,
    // For IOS
    shadowColor: "#000",
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
  dividerContainer: {
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: -10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    // backgroundColor: '#ccc',
    backgroundColor: COLORS.backgroundColor,
  },
  dividerButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    marginHorizontal: 10,
  },
  dividerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TokenSwap;
