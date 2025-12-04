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
import hathorLib from '@hathor/wallet-lib';

import { IS_MULTI_TOKEN } from '../constants';
import { renderValue, isTokenNFT } from '../utils';
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
  const [networkFee, setNetworkFee] = useState(null);
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
    (async () => {
      const FBTVersion = 1; // XXX: hathorLib.TokenVersion.FEE
      if (token.version && token.version === FBTVersion) {
        setNetworkFee(0n);
        return;
      }
      try {
        const { changeAmount } = await this.wallet.getUtxosForAmount(amountValue, { token: token.uid });
        if (changeAmount) {
          // Since there is change, it means we will have the intended output and a change output.
          // 2 FBT outputs means the fee value will be payed twice
          setNetworkFee(2n);
        } else {
          // No change means that there will only be the intended output.
          setNetworkFee(1n);
        }
      } catch (err) {
        setNetworkFee(1n);
      }
    })();
  }, [wallet, token, amountValue]);

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

    const FBTVersion = 1; // XXX: hathorLib.TokenVersion.FEE
    if (token.version && token.version === FBTVersion) {
      // The user selected a fee based token
      // So we need to check the HTR balance to make the transaction happen.
      const htrBalance = get(tokensBalance, hathorLib.constants.NATIVE_TOKEN_UID);
      if (!htrBalance) {
        setError('Insufficient balance of HTR to cover the network fee.');
        return;
      }
      const { available: htrAvailable } = htrBalance.data;
      if (networkFee > htrAvailable) {
        setError('Insufficient balance of HTR to cover the network fee.');
        return;
      }
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
