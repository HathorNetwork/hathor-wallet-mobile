/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import AmountTextInput from '../../components/AmountTextInput';
import InputLabel from '../../components/InputLabel';
import OfflineBar from '../../components/OfflineBar';
import { SyncingNotice } from '../../components/Multichain/SyncingNotice';
import { canTransfer, CHAIN, NEXT_DECIMAL_PLACES } from '../../multichain/chains';
import { syncingSendBody } from '../../multichain/content';
import { selectSideChainConfig } from '../../multichain/gating';
import { shortBalanceAdvice } from '../../multichain/transfer';
import { useTransferContext } from './ChainTransferScreen';
import { getKeyboardAvoidingViewTopDistance } from '../../utils';
import { renderNextValue } from '../../multichain/amount';
import { useNavigation, useParams } from '../../hooks/navigation';
import { COLORS } from '../../styles/themes';

/**
 * The flat fee of a Hathor Next payment, as the client reported it on connect.
 *
 * @param {Object} state Redux state
 * @returns {bigint}
 */
export const selectNextSendFee = (state) => state.multichain.next.sendFee;

/**
 * The amount of a Hathor Next payment. Only the native token, HTR, can be sent on Hathor Next
 * today, so there is no token to pick. The flat fee comes on top of the amount. While the first
 * sync runs, sending waits for it. An amount Hathor Next doesn't have, but Hathor Network does,
 * offers the transfer between chains instead.
 */
export default function NextSendAmountInput() {
  const navigation = useNavigation();
  const { address } = useParams();
  const config = useSelector(selectSideChainConfig);
  const nativeTokenId = config?.nativeTokenId;
  const available = useSelector(
    (state) => state.multichain.next.balances[nativeTokenId]?.data?.available ?? 0n,
  );
  const sweeping = useSelector((state) => state.multichain.next.sweeping);
  const online = useSelector((state) => state.multichain.next.online);
  const [amountText, setAmountText] = useState('');
  const [amount, setAmount] = useState(null);
  const [error, setError] = useState(null);
  const [advice, setAdvice] = useState(null);
  const inputRef = useRef(null);
  const { bridge, decimalPlaces: hathorDecimalPlaces, available: hathorAvailable } = (
    useTransferContext()
  );
  const ownAddress = useSelector((state) => state.multichain.next.address);

  const fee = useSelector(selectNextSendFee);
  const symbol = config?.nativeTokenSymbol ?? 'HTR';
  const render = (value) => renderNextValue(value, hathorDecimalPlaces);
  const availableText = render(available);
  const feeText = render(fee);

  const onAmountChange = (text, value) => {
    setAmountText(text);
    setAmount(value);
    setError(null);
    setAdvice(null);
  };

  // What the user is told when Hathor Next doesn't have the amount: Hathor Network may.
  const adviseShortBalance = () => {
    const mapped = config?.tokenMap?.some((pair) => pair.next === nativeTokenId);
    if (!mapped) {
      return null;
    }
    const quote = bridge && canTransfer(config, CHAIN.HATHOR, CHAIN.HATHOR_NEXT)
      ? bridge.quote({
        from: CHAIN.HATHOR, to: CHAIN.HATHOR_NEXT, amount: 0n, available: hathorAvailable,
      })
      : null;
    return shortBalanceAdvice({
      chain: CHAIN.HATHOR_NEXT,
      amount,
      fee,
      available,
      otherAvailable: hathorAvailable,
      config,
      quote,
      symbol,
      hathorDecimalPlaces,
      toAddress: address,
      ownAddress,
    });
  };

  const onNext = () => {
    if (!amount) {
      setError(t`Invalid amount`);
      return;
    }
    if (amount + fee > available) {
      const shortBalance = adviseShortBalance();
      setAdvice(shortBalance);
      setError(shortBalance ? null : t`Insufficient funds`);
      return;
    }
    navigation.navigate('NextSendConfirmScreen', {
      address,
      amount: amount.toString(),
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()}>
        <HathorHeader
          withBorder
          title={t`SEND ${symbol}`}
          onBackPress={() => navigation.goBack()}
        />
        <KeyboardAvoidingView
          behavior='padding'
          style={{ flex: 1 }}
          keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}
        >
          <View style={styles.body}>
            <View>
              <View style={styles.amountRow}>
                <AmountTextInput
                  ref={inputRef}
                  autoFocus
                  onAmountUpdate={onAmountChange}
                  value={amountText}
                  decimalPlaces={NEXT_DECIMAL_PLACES}
                  style={{ flex: 1 }}
                />
                <Text style={styles.symbol}>{symbol}</Text>
              </View>
              <InputLabel style={styles.available}>
                {t`${availableText} ${symbol} available`}
              </InputLabel>
              <Text style={styles.fee}>{t`Network fee: ${feeText} ${symbol}`}</Text>
              {sweeping && <SyncingNotice text={syncingSendBody()} style={styles.syncing} />}
              <Text style={styles.error}>{error}</Text>
              {advice && <Text style={styles.advice}>{advice.message}</Text>}
              {advice?.transfer && (
                <NewHathorButton
                  secondary
                  title={t`Transfer between chains`}
                  onPress={() => navigation.navigate('ChainTransfer', {
                    toAddress: advice.transfer.toAddress,
                    amount: advice.transfer.amount.toString(),
                  })}
                  style={styles.adviceButton}
                />
              )}
            </View>
            <NewHathorButton
              title={t`Next`}
              disabled={!amount || sweeping || !online}
              onPress={onNext}
            />
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
  },
  symbol: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textColorShadow,
  },
  available: {
    textAlign: 'center',
    marginTop: 8,
  },
  fee: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
    color: COLORS.textColorShadow,
  },
  syncing: {
    marginTop: 16,
  },
  advice: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: COLORS.textColor,
  },
  adviceButton: {
    marginTop: 12,
  },
  error: {
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
    color: COLORS.errorTextColor,
  },
});
