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
  TouchableOpacity,
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
import {
  tokenSwapSetInputTokenAmount,
  tokenSwapSetOutputTokenAmount,
  tokenSwapSetInputToken,
  tokenSwapSetOutputToken,
} from '../actions';


const SwapDivider = ({ onPress }) => {
  return (
    <View style={styles.dividerContainer}>
      <View style={styles.dividerLine} />
      <TouchableOpacity style={styles.dividerButton} onPress={onPress}>
        <Text style={styles.dividerButtonText}>{"<icon>"}</Text>
      </TouchableOpacity>
      <View style={styles.dividerLine} />
    </View>
  );
};

const TokenSwap = () => {
  const dispatch = useDispatch();
  const tokensBalance = useSelector((state) => state.tokensBalance);

  const [inputToken, setInputToken] = useState(null);
  const [outputToken, setOutputToken] = useState(null);

  const [inputTokenAmountStr, setInputTokenAmountStr] = useState();
  const [inputTokenAmount, setInputTokenAmount] = useState();

  const [outputTokenAmountStr, setOutputTokenAmountStr] = useState();
  const [outputTokenAmount, setOutputTokenAmount] = useState();

  const {
    allowedTokens,
    inputToken: reduxInputToken,
    inputTokenAmount: reduxInputTokenAmount,
    outputToken: reduxOutputToken,
    outputTokenAmount: reduxOutputTokenAmount,
  } = useSelector((state) => state.tokenSwap);
  const { decimalPlaces } = useSelector((state) => ({
    decimalPlaces: state.serverInfo?.decimal_places
  }));

  const navigation = useNavigation();

  useEffect(() => {
    if (!reduxInputToken) {
      setInputToken(allowedTokens[0]);
      dispatch(tokenSwapSetInputToken(allowedTokens[0]));
    } else {
      setInputToken(reduxInputToken);
    }
  }, [reduxInputToken]);

  useEffect(() => {
    if (!reduxOutputToken) {
      setOutputToken(allowedTokens[1]);
      dispatch(tokenSwapSetOutputToken(allowedTokens[1]));
    } else {
      setOutputToken(reduxOutputToken);
    }
  }, [reduxOutputToken]);

  function onInputAmountChange(text, value) {
    setInputTokenAmountStr(text);
    setInputTokenAmount(value);
    // setError(null);
    // dispatch event to update reduxInputTokenAmount
    // The event should also reset outputTokenAmount
    dispatch(tokenSwapSetInputTokenAmount(value));
  }

  function onInputAmountEndEditing(text) {
    console.log(JSON.stringify(text));
    // console.log(`User added ${text} tokens on input`);
  }

  function onOutputAmountEndEditing(text) {
    console.log(JSON.stringify(text));
    // console.log(`User added ${text} tokens on output`);
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
    navigation.navigate('TokenSwapListInputToken', { token: inputToken.uid });
  };

  const onOutputTokenBoxPress = () => {
    navigation.navigate('TokenSwapListOutputToken', { token: outputToken.uid });
  };

  const switchTokens = () => {
    // XXX
    // dispatch(tokenSwapSwitchTokens());
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
    if (!token) {
      return;
    }
    const balance = get(tokensBalance, `${token.uid}.data`, {
      available: 0n,
      locked: 0n,
    });
    const { available } = balance;
    const amountAndToken = `${renderValue(available, false)} ${token.symbol}`;
    const availableCount = Number(available);
    return ngettext(msgid`${amountAndToken} available`, `${amountAndToken} available`, availableCount);
  };

  const onButtonPress = () => {
    console.log(`Button pressed!`);
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
              <View style={styles.tokenRow}>
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

            <SwapDivider onPress={switchTokens} />

            <View style={styles.card}>
              <View style={styles.tokenRow}>
                {renderGhostElement()}
                <AmountTextInput
                  onAmountUpdate={onOutputAmountChange}
                  onEndEditing={onOutputAmountEndEditing}
                  value={outputTokenAmountStr}
                  allowOnlyInteger={false}
                  decimalPlaces={decimalPlaces}
                  style={{ flex: 1 }} // we need this so the placeholder doesn't break in android
                  // devices after erasing the text
                  // https://github.com/facebook/react-native/issues/30666
                />
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
  screenContent: {
    flex: 1,
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
  amountAvailable: { textAlign: 'center', marginTop: 8, marginBottom: 4 },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 40,
    padding: 8,
  },
  card: {
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
  // divider: {
  //   width: '100%',
  //   height: 1,
  //   backgroundColor: '#ccc',
  //   marginVertical: 15, // Space around the divider
  // },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20, // Adjust as needed for spacing
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ccc', // Color of the divider lines
  },
  dividerButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20, // Rounded button
    backgroundColor: COLORS.primary, // Button background color
    marginHorizontal: 10, // Spacing between lines and button
  },
  dividerButtonText: {
    color: '#fff', // Button text color
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TokenSwap;
