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

import { IS_MULTI_TOKEN } from '../constants';
import { renderValue, isTokenNFT, computeAmountFontFit } from '../utils';
import NewHathorButton from '../components/NewHathorButton';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import TokenBox from '../components/TokenBox';
import HathorHeader from '../components/HathorHeader';
import OfflineBar from '../components/OfflineBar';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';
import { COLORS } from '../styles/themes';
import { useNavigation, useParams } from '../hooks/navigation';

const SendAmountInput = () => {
  const selectedToken = useSelector((state) => state.selectedToken);
  const tokensBalance = useSelector((state) => state.tokensBalance);
  const tokenMetadata = useSelector((state) => state.tokenMetadata);
  const { decimalPlaces } = useSelector((state) => ({
    decimalPlaces: state.serverInfo?.decimal_places
  }));

  const navigation = useNavigation();
  const params = useParams();

  const [amount, setAmount] = useState('');
  const [amountValue, setAmountValue] = useState(null);
  const [token, setToken] = useState(selectedToken);
  const [error, setError] = useState(null);
  const [amountAreaWidth, setAmountAreaWidth] = useState(0);
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

    const { address } = params;
    navigation.navigate('SendConfirmScreen', { address, amount: amountValue, token });
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
    const amountAndToken = `${renderValue(available, isNFT(), decimalPlaces)} ${token.symbol}`;
    const availableCount = Number(available);
    return ngettext(msgid`${amountAndToken} available`, `${amountAndToken} available`, availableCount);
  };

  const renderGhostElement = () => (
    <View style={{ width: 80, height: 40 }} />
  );

  const tokenNameUpperCase = token.name.toUpperCase();

  // Left ghost spacer (80, see renderGhostElement) + token box (90, see
  // TokenBox styles.wrapper). The measured amount-area width is layout-
  // independent (full content width in both row and column modes), so the fit
  // decision never feeds back on itself.
  const TOKEN_BOX_ROW_RESERVED = 170;
  const placeholderString = isNFT() ? '0' : `0.${'0'.repeat(decimalPlaces)}`;
  const displayedAmount = amount || placeholderString;
  const inlineWidth = amountAreaWidth > 0 ? amountAreaWidth - TOKEN_BOX_ROW_RESERVED : 0;
  // Size against the width beside the token box (inlineWidth) so the amount
  // shrinks to fit there first, then wraps. Sizing by inlineWidth rather than the
  // full amount-area width keeps the font continuous across the row->column
  // switch (no size jump) — see computeAmountFontFit.
  const { fontSize: amountFontSize, wraps: isStacked } = computeAmountFontFit(
    displayedAmount.length,
    inlineWidth,
  );

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
              {/* A single View whose flexDirection switches row->column keeps the
                  AmountTextInput mounted across the threshold, avoiding the
                  focus/keyboard flicker a remount would cause mid-typing. */}
              <View
                onLayout={(e) => setAmountAreaWidth(e.nativeEvent.layout.width)}
                style={{
                  flexDirection: isStacked ? 'column' : 'row',
                  alignItems: 'center',
                  justifyContent: isStacked ? 'flex-start' : 'space-between',
                  marginTop: 40,
                }}
              >
                {!isStacked && renderGhostElement()}
                <AmountTextInput
                  ref={inputRef}
                  autoFocus
                  onAmountUpdate={onAmountChange}
                  value={amount}
                  allowOnlyInteger={isNFT()}
                  decimalPlaces={decimalPlaces}
                  fontSize={amountFontSize}
                  singleLine={!isStacked}
                  // flex:1 (row) also keeps the android placeholder from breaking
                  // after erasing text: https://github.com/facebook/react-native/issues/30666
                  style={isStacked ? { alignSelf: 'stretch' } : { flex: 1 }}
                />
                {IS_MULTI_TOKEN
                  ? (
                    <TokenBox
                      onPress={onTokenBoxPress}
                      label={token.symbol}
                      style={isStacked ? { marginTop: 8 } : undefined}
                    />
                  )
                  : (!isStacked && renderGhostElement())}
              </View>
              <InputLabel style={{ textAlign: 'center', marginTop: 8 }}>
                {getAvailableString()}
              </InputLabel>
              <Text style={styles.error}>{error}</Text>
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

export default SendAmountInput;
