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
import { NextTokenPicker } from '../../components/Multichain/NextTokenPicker';
import { canTransfer, CHAIN, NEXT_DECIMAL_PLACES } from '../../multichain/chains';
import { syncingSendBody } from '../../multichain/content';
import { selectSideChainConfig } from '../../multichain/gating';
import { shortBalanceAdvice } from '../../multichain/transfer';
import { nextTokenList } from '../../multichain/tokens';
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
 * The fee a Hathor Next payment pays in the native token, when the native token isn't what it
 * sends and the wallet holds too little of it.
 *
 * @param {string} feeText The fee, as shown
 * @param {string} nativeSymbol
 * @returns {string}
 */
export const feeShortText = (feeText, nativeSymbol) => (
  t`The network fee is paid in ${nativeSymbol}. You need ${feeText} ${nativeSymbol} on Hathor Next.`
);

/**
 * The amount of a Hathor Next payment, in one of the tokens the wallet holds there: the native
 * token unless the user picks another (the picker shows when it holds another). The flat fee is
 * always paid in the native token: on top of the amount when the payment sends it, from the native
 * balance otherwise. While the first sync runs, sending waits for it. An amount Hathor Next
 * doesn't have, of a token the bridge carries, offers the transfer between chains instead, when
 * Hathor Network has it.
 */
export default function NextSendAmountInput() {
  const navigation = useNavigation();
  const params = useParams();
  const { address } = params;
  const config = useSelector(selectSideChainConfig);
  const nativeTokenId = config?.nativeTokenId;
  const tokens = useSelector((state) => state.multichain.next.tokens);
  const balances = useSelector((state) => state.multichain.next.balances);
  const [pickedTokenId, setPickedTokenId] = useState(null);
  const tokenId = pickedTokenId ?? params.tokenId ?? nativeTokenId;
  const native = tokenId === nativeTokenId;
  const balanceOf = (id) => balances[id]?.data?.available ?? 0n;
  const available = balanceOf(tokenId);
  const nativeAvailable = balanceOf(nativeTokenId);
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
  const nativeSymbol = config?.nativeTokenSymbol ?? 'HTR';
  const symbol = native ? nativeSymbol : (tokens[tokenId]?.symbol ?? '');
  const render = (value) => renderNextValue(value, hathorDecimalPlaces);
  const availableText = render(available);
  const feeText = render(fee);
  // The tokens a payment can send: the native one, and every other the wallet holds some of.
  const options = nextTokenList(tokens, nativeTokenId)
    .filter((token) => token.uid === nativeTokenId || balanceOf(token.uid) > 0n)
    .map((token) => ({
      id: token.uid,
      symbol: token.uid === nativeTokenId ? nativeSymbol : token.symbol,
      name: token.name,
      balance: render(balanceOf(token.uid)),
    }));

  const onTokenChange = (id) => {
    setPickedTokenId(id);
    setError(null);
    setAdvice(null);
  };

  const onAmountChange = (text, value) => {
    setAmountText(text);
    setAmount(value);
    setError(null);
    setAdvice(null);
  };

  // What the user is told when Hathor Next doesn't have the amount: Hathor Network may, for the
  // token the bridge carries.
  const adviseShortBalance = () => {
    const mapped = native && config?.tokenMap?.some((pair) => pair.next === nativeTokenId);
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
    if ((native ? amount + fee : amount) > available) {
      const shortBalance = adviseShortBalance();
      setAdvice(shortBalance);
      setError(shortBalance ? null : t`Insufficient funds`);
      return;
    }
    if (!native && fee > nativeAvailable) {
      setError(feeShortText(feeText, nativeSymbol));
      return;
    }
    navigation.navigate('NextSendConfirmScreen', {
      address,
      amount: amount.toString(),
      tokenId,
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
                {options.length > 1 ? (
                  <View style={styles.picker}>
                    <NextTokenPicker
                      tokenId={tokenId}
                      symbol={symbol}
                      options={options}
                      onChange={onTokenChange}
                    />
                  </View>
                ) : (
                  <Text style={styles.symbol}>{symbol}</Text>
                )}
              </View>
              <InputLabel style={styles.available}>
                {t`${availableText} ${symbol} available`}
              </InputLabel>
              <Text style={styles.fee}>{t`Network fee: ${feeText} ${nativeSymbol}`}</Text>
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
  picker: {
    marginLeft: 8,
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
