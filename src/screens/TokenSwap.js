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
  NativeEventEmitter,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';

const { SoftInputModule } = NativeModules;
import { useDispatch, useSelector } from 'react-redux';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { t } from 'ttag';
import { get } from 'lodash';
import { SwapIcon } from '../components/Icons/Swap.icon';
import AmountInputAccessory from '../components/AmountInputAccessory';

import { renderValue, formatAmountToInput } from '../utils';
import {
  calcAmountWithSlippage,
  renderAmountAndSymbolWithSlippage,
  renderConversionRate,
  selectTokenSwapAllowedTokens,
} from '../utils/tokenSwap';
import NewHathorButton from '../components/NewHathorButton';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import TokenBox from '../components/TokenBox';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import { COLORS } from '../styles/themes';
import { useNavigation } from '../hooks/navigation';
import {
  tokenFetchBalanceRequested,
  tokenSwapFetchSwapQuote,
  tokenSwapResetSwapData,
  tokenSwapSetInputToken,
  tokenSwapSetOutputToken,
  tokenSwapSwitchTokens,
} from '../actions';
import NavigationService from '../NavigationService';
import { TOKEN_SWAP_SLIPPAGE } from '../constants';

const INPUT_ACCESSORY_VIEW_ID = 'tokenSwapAmountInput';
const OUTPUT_ACCESSORY_VIEW_ID = 'tokenSwapAmountOutput';

function getAvailableAmount(token, tokensBalance) {
  if (!token) {
    return 0n;
  }
  return get(tokensBalance, `${token.uid}.data.available`, 0n);
}

const SwapDivider = ({ onPress }) => (
  <View style={styles.dividerContainer}>
    <View style={styles.dividerLine} />
    <TouchableOpacity style={styles.dividerButton} onPress={onPress}>
      <SwapIcon color={COLORS.white} />
    </TouchableOpacity>
    <View style={styles.dividerLine} />
  </View>
);

const TokenSwap = () => {
  const dispatch = useDispatch();
  const tokensBalance = useSelector((state) => state.tokensBalance);

  const [inputTokenAmountStr, setInputTokenAmountStr] = useState('');
  const [inputTokenAmount, setInputTokenAmount] = useState(0n);

  const [outputTokenAmountStr, setOutputTokenAmountStr] = useState('');
  const [outputTokenAmount, setOutputTokenAmount] = useState(0n);

  const [swapDirection, setSwapDirection] = useState(null);

  const [showQuote, setShowQuote] = useState(false);

  const [editing, setEditing] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Ref to track editing timeout so we can cancel it on new focus
  const editingTimeoutRef = useRef(null);

  // Listen for keyboard height from native module (Android only)
  // Uses WindowInsets API which works on modern Android where SOFT_INPUT_ADJUST_RESIZE is deprecated
  useEffect(() => {
    if (Platform.OS !== 'android' || !SoftInputModule) {
      return undefined;
    }

    const eventEmitter = new NativeEventEmitter(SoftInputModule);
    const subscription = eventEmitter.addListener('keyboardHeightChanged', (event) => {
      setKeyboardHeight(event.height);
      setKeyboardVisible(event.isVisible);
    });

    SoftInputModule.startKeyboardListener();

    return () => {
      subscription.remove();
      SoftInputModule.stopKeyboardListener();
    };
  }, []);

  const allowedTokens = useSelector(selectTokenSwapAllowedTokens);
  const {
    inputToken,
    outputToken,
    swapPathQuote: quote,
  } = useSelector((state) => state.tokenSwap);
  const { decimalPlaces } = useSelector((state) => ({
    decimalPlaces: state.serverInfo?.decimal_places
  }));

  const navigation = useNavigation();

  // Cleanup editing timeout on unmount
  useEffect(() => () => {
    if (editingTimeoutRef.current) {
      clearTimeout(editingTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    for (const tk of allowedTokens) {
      dispatch(tokenFetchBalanceRequested(tk.uid, true));
    }
  }, [allowedTokens]);

  useEffect(() => {
    setShowQuote(false);
    if (!inputToken) {
      dispatch(tokenSwapSetInputToken(allowedTokens[0]));
      return;
    }
    // Clear both amounts when input token changes
    setInputTokenAmount(0n);
    setInputTokenAmountStr('');
    setOutputTokenAmount(0n);
    setOutputTokenAmountStr('');
  }, [inputToken]);

  useEffect(() => {
    setShowQuote(false);
    if (!outputToken) {
      dispatch(tokenSwapSetOutputToken(allowedTokens[1]));
      return;
    }
    // Clear both amounts when output token changes
    setInputTokenAmount(0n);
    setInputTokenAmountStr('');
    setOutputTokenAmount(0n);
    setOutputTokenAmountStr('');
  }, [outputToken]);

  useEffect(() => {
    setShowQuote(!!quote);
    if (quote) {
      setInputTokenAmountStr(renderValue(quote.amount_in));
      setInputTokenAmount(quote.amount_in);
      setOutputTokenAmountStr(renderValue(quote.amount_out));
      setOutputTokenAmount(quote.amount_out);
    }
  }, [quote]);

  function onInputAmountChange(text, value) {
    setInputTokenAmountStr(text);
    setInputTokenAmount(value);
  }

  function onInputAmountEndEditing(_target) {
    setOutputTokenAmountStr('');
    setOutputTokenAmount(0n);
    setSwapDirection('input');
    editingTimeoutRef.current = setTimeout(() => {
      setEditing(null);
      editingTimeoutRef.current = null;
    }, 500);

    if (inputTokenAmount) {
      dispatch(tokenSwapFetchSwapQuote('input', inputTokenAmount.toString(10), inputToken.uid, outputToken.uid));
    }
  }

  function onOutputAmountEndEditing(_target) {
    setInputTokenAmountStr('');
    setInputTokenAmount(0n);
    setSwapDirection('output');
    editingTimeoutRef.current = setTimeout(() => {
      setEditing(null);
      editingTimeoutRef.current = null;
    }, 500);

    if (outputTokenAmount) {
      dispatch(tokenSwapFetchSwapQuote('output', outputTokenAmount.toString(10), inputToken.uid, outputToken.uid));
    }
  }

  function onOutputAmountChange(text, value) {
    setOutputTokenAmountStr(text);
    setOutputTokenAmount(value);
  }

  function onFocus(dirClicked) {
    // Clear any pending timeout from previous blur to prevent stale state update
    if (editingTimeoutRef.current) {
      clearTimeout(editingTimeoutRef.current);
      editingTimeoutRef.current = null;
    }
    setEditing(dirClicked);
    setSwapDirection(null);
    setShowQuote(false);
    if (dirClicked === 'input') {
      // Remove thousand separators for editing
      if (inputTokenAmount && inputTokenAmount > 0n) {
        setInputTokenAmountStr(formatAmountToInput(inputTokenAmount, decimalPlaces));
      }
      setOutputTokenAmount(0n);
      setOutputTokenAmountStr('');
    } else if (dirClicked === 'output') {
      // Remove thousand separators for editing
      if (outputTokenAmount && outputTokenAmount > 0n) {
        setOutputTokenAmountStr(formatAmountToInput(outputTokenAmount, decimalPlaces));
      }
      setInputTokenAmount(0n);
      setInputTokenAmountStr('');
    }
  }

  const onInputTokenBoxPress = () => {
    navigation.navigate('TokenSwapListInputToken', { token: inputToken });
  };

  const onOutputTokenBoxPress = () => {
    navigation.navigate('TokenSwapListOutputToken', { token: outputToken });
  };

  const switchTokens = () => {
    setInputTokenAmountStr('');
    setInputTokenAmount(0n);
    setOutputTokenAmountStr('');
    setOutputTokenAmount(0n);
    // Also switch the direction of the swap
    if (swapDirection === 'input') {
      setSwapDirection('output');
    } else if (swapDirection === 'output') {
      setSwapDirection('input');
    }

    // switch the tokens being swapped
    dispatch(tokenSwapSwitchTokens());
  };

  /**
   * Handles percentage button press from the keyboard accessory.
   * Calculates the amount based on the percentage of available balance
   * for the currently focused input field.
   *
   * @param {number} percentage - The percentage to apply (25, 50, or 100)
   */
  const onPercentagePress = (percentage) => {
    const token = editing === 'input' ? inputToken : outputToken;
    const availableBalance = getAvailableAmount(token, tokensBalance);

    if (!availableBalance || availableBalance === 0n) {
      return;
    }

    const amount = (availableBalance * BigInt(percentage)) / 100n;
    const amountStr = formatAmountToInput(amount, decimalPlaces);

    if (editing === 'input') {
      onInputAmountChange(amountStr, amount);
      setOutputTokenAmountStr('');
      setOutputTokenAmount(0n);
    } else if (editing === 'output') {
      onOutputAmountChange(amountStr, amount);
      setInputTokenAmountStr('');
      setInputTokenAmount(0n);
    }
    // Quote will be fetched when keyboard dismisses via onEndEditing handlers
  };

  /**
   * We need to check that the quoted amount is valid even after we apply the slippage.
   * The value can be invalid if the quoted amount is 0.01 and with slippage it comes to 0.00
   * This would mean we have either a deposit or withdrawal of 0 which should not happen.
   * To avoid this we need this check.
   */
  const checkQuotedAmount = () => {
    if (!(quote && quote.direction)) {
      return false;
    }

    let quotedAmount = 0n;
    if (quote.direction === 'input') {
      quotedAmount = calcAmountWithSlippage('input', quote.amount_out, TOKEN_SWAP_SLIPPAGE);
    } else if (swapDirection === 'output') {
      quotedAmount = calcAmountWithSlippage('output', quote.amount_in, TOKEN_SWAP_SLIPPAGE);
    }

    return quotedAmount > 0n;
  };

  const isReviewButtonDisabled = () => (
    !inputTokenAmountStr
      || !inputTokenAmount
      || inputTokenAmount === 0n
      || !outputTokenAmountStr
      || !outputTokenAmount
      || outputTokenAmount === 0n
      || getAvailableAmount(inputToken, tokensBalance) < inputTokenAmount
      || !checkQuotedAmount()
  );

  const getAvailableString = (token) => {
    if (!token) {
      return '';
    }
    const available = getAvailableAmount(token, tokensBalance);
    const amount = `${renderValue(available, false)}`;
    return t`Balance: ${amount}`;
  };

  const onReviewButtonPress = (quoteArg, tokenIn, tokenOut) => {
    navigation.navigate('TokenSwapReview', {
      quote: quoteArg,
      tokenIn,
      tokenOut,
    });
  };

  /**
   * Method executed after dismiss success modal
   */
  const exitToMainScreen = () => {
    dispatch(tokenSwapResetSwapData());
    NavigationService.resetToMain();
  };

  return (
    <View style={styles.screenContent}>
      {/* iOS: Separate InputAccessoryViews for each TextInput */}
      {Platform.OS === 'ios' && (
        <>
          <AmountInputAccessory
            nativeID={INPUT_ACCESSORY_VIEW_ID}
            availableBalance={getAvailableAmount(inputToken, tokensBalance)}
            onPercentagePress={onPercentagePress}
          />
          <AmountInputAccessory
            nativeID={OUTPUT_ACCESSORY_VIEW_ID}
            availableBalance={getAvailableAmount(outputToken, tokensBalance)}
            onPercentagePress={onPercentagePress}
          />
        </>
      )}
      {/* Android: position accessory absolutely above keyboard using native keyboard height */}
      {Platform.OS === 'android' && editing === 'input' && keyboardVisible && (
        <View style={[styles.androidAccessory, { bottom: keyboardHeight }]}>
          <AmountInputAccessory
            nativeID={INPUT_ACCESSORY_VIEW_ID}
            availableBalance={getAvailableAmount(inputToken, tokensBalance)}
            onPercentagePress={onPercentagePress}
            visible
          />
        </View>
      )}
      {Platform.OS === 'android' && editing === 'output' && keyboardVisible && (
        <View style={[styles.androidAccessory, { bottom: keyboardHeight }]}>
          <AmountInputAccessory
            nativeID={OUTPUT_ACCESSORY_VIEW_ID}
            availableBalance={getAvailableAmount(outputToken, tokensBalance)}
            onPercentagePress={onPercentagePress}
            visible
          />
        </View>
      )}
      <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()}>
        <HathorHeader
          withBorder
          title={t`TOKEN SWAP`}
          onBackPress={exitToMainScreen}
        />
        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getStatusBarHeight()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View>
              <View style={styles.card}>
                <View style={styles.tokenCard}>
                  <AmountTextInput
                    onAmountUpdate={onInputAmountChange}
                    onEndEditing={onInputAmountEndEditing}
                    onFocus={() => onFocus('input')}
                    value={inputTokenAmountStr}
                    allowOnlyInteger={false}
                    decimalPlaces={decimalPlaces}
                    style={swapDirection === 'output' ? styles.amountInputTextFaded : styles.amountInputText}
                    editable={editing !== 'output'}
                    textAlign='left'
                    inputAccessoryViewID={INPUT_ACCESSORY_VIEW_ID}
                  />
                  <View>
                    <View style={styles.tokenSelectorWrapper}>
                      { inputToken ? (
                        <TokenBox onPress={onInputTokenBoxPress} label={inputToken.symbol} />
                      ) : (
                        <TokenBox label='' />
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
                  <AmountTextInput
                    onAmountUpdate={onOutputAmountChange}
                    onEndEditing={onOutputAmountEndEditing}
                    onFocus={() => onFocus('output')}
                    value={outputTokenAmountStr}
                    allowOnlyInteger={false}
                    decimalPlaces={decimalPlaces}
                    style={swapDirection === 'input' ? styles.amountInputTextFaded : styles.amountInputText}
                    editable={editing !== 'input'}
                    textAlign='left'
                    inputAccessoryViewID={OUTPUT_ACCESSORY_VIEW_ID}
                  />
                  <View>
                    <View style={styles.tokenSelectorWrapper}>
                      { outputToken ? (
                        <TokenBox onPress={onOutputTokenBoxPress} label={outputToken.symbol} />
                      ) : (
                        <TokenBox label='' />
                      )}
                    </View>
                    <InputLabel style={styles.amountAvailable}>
                      {getAvailableString(outputToken)}
                    </InputLabel>
                  </View>
                </View>
              </View>

              { showQuote && quote && (
                <View style={styles.quoteContainer}>
                  <View style={styles.quoteRow}>
                    <Text style={styles.quoteHeader}>Conversion rate</Text>
                    <Text style={styles.quoteValue}>
                      {renderConversionRate(quote, inputToken, outputToken)}
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
                      <Text style={styles.quoteValue}>{renderAmountAndSymbolWithSlippage('input', quote.amount_out, outputToken, TOKEN_SWAP_SLIPPAGE)}</Text>
                    </View>
                  )}
                  { quote.direction === 'output' && (
                    <View style={styles.quoteRow}>
                      <Text style={styles.quoteHeader}>Maximum to deposit</Text>
                      <Text style={styles.quoteValue}>{renderAmountAndSymbolWithSlippage('output', quote.amount_in, inputToken, TOKEN_SWAP_SLIPPAGE)}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={styles.buttonContainer}>
              <NewHathorButton
                title={t`REVIEW`}
                disabled={isReviewButtonDisabled()}
                onPress={() => onReviewButtonPress(quote, inputToken, outputToken)}
              />
            </View>
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
    backgroundColor: COLORS.backgroundColor,
  },
  androidAccessory: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
  },
  buttonContainer: {
    marginBottom: 16,
  },
  tokenSelectorWrapper: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginRight: 10,
  },
  amountAvailable: {
    marginTop: 8,
    marginBottom: 4,
  },
  amountInputText: { // https://github.com/facebook/react-native/issues/30666
    flex: 1,
    marginBottom: 30,
  },
  amountInputTextFaded: {
    flex: 1,
    marginBottom: 30,
    color: COLORS.lightShadow,
  },
  tokenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 30,
    paddingVertical: 8,
    paddingLeft: 24,
    paddingRight: 8,
  },
  card: {
    zIndex: 1,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundColor,
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
  },
  quoteHeader: {
    fontWeight: '500',
    flexShrink: 0,
  },
  quoteValue: {
    fontWeight: '300',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
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
    backgroundColor: COLORS.backgroundColor,
  },
  dividerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    marginHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerButtonText: {
    color: COLORS.backgroundColor,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TokenSwap;
