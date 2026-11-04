/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { Network } from '@hathor/wallet-lib';
import { t } from 'ttag';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import AmountTextInput from '../../components/AmountTextInput';
import OfflineBar from '../../components/OfflineBar';
import { ChainTag } from '../../components/Multichain/ChainTag';
import { SimulatedTagIfMock } from '../../components/Multichain/SimulatedTag';
import { validateTransferAddress } from '../../multichain/address';
import { arrivalText } from '../../multichain/transfer';
import { createBridge } from '../../multichain/bridge';
import { CHAIN, CHAIN_NAME, canTransfer, transferReceiveSymbol } from '../../multichain/chains';
import { renderNextValue } from '../../multichain/amount';
import { selectMultichainNetwork, selectSideChainConfig } from '../../multichain/gating';
import { getKeyboardAvoidingViewTopDistance, renderValue } from '../../utils';
import { DEFAULT_TOKEN } from '../../constants';
import { COLORS } from '../../styles/themes';

const HTR_UID = '00';

/**
 * An amount as the amount field takes it: digits and the decimal point, with no separators.
 *
 * @param {bigint} amount In base units
 * @param {number} decimalPlaces
 * @returns {string}
 */
export function plainAmount(amount, decimalPlaces) {
  const digits = amount.toString().padStart(decimalPlaces + 1, '0');
  if (!decimalPlaces) {
    return digits;
  }
  return `${digits.slice(0, -decimalPlaces)}.${digits.slice(-decimalPlaces)}`;
}

/**
 * The bridge, and what a transfer from Hathor Network has to spend: its native token, by the
 * symbol the fullnode reports.
 *
 * @returns {{
 *   bridge: Object,
 *   config: Object,
 *   decimalPlaces: number,
 *   available: bigint,
 *   symbol: string,
 * }}
 */
export function useTransferContext() {
  const config = useSelector(selectSideChainConfig);
  const network = useSelector(selectMultichainNetwork);
  const decimalPlaces = useSelector((state) => state.serverInfo?.decimal_places ?? 2);
  const symbol = useSelector(
    (state) => state.serverInfo?.native_token?.symbol ?? DEFAULT_TOKEN.symbol,
  );
  const available = useSelector(
    (state) => state.tokensBalance?.[HTR_UID]?.data?.available ?? 0n,
  );
  const bridge = useMemo(
    () => (config ? createBridge(config, { network, decimalPlaces }) : null),
    [config, network, decimalPlaces],
  );
  return { bridge, config, decimalPlaces, available, symbol };
}

/**
 * The transfer between chains. It is built for both directions and any token the bridge carries;
 * the bridge transfers only HTR from Hathor Network to Hathor Next so far, so the swap button
 * says the other way isn't there yet, and the token is HTR. The user enters the address (or fills
 * in their own) and the amount; Send's short-balance message opens it with both filled in.
 */
export default function ChainTransferScreen({ navigation, route }) {
  const { bridge, config, decimalPlaces, available, symbol } = useTransferContext();
  const networkName = useSelector((state) => state.networkSettings.network);
  const ownAddress = useSelector((state) => state.multichain.next.address);
  const prefill = route?.params ?? {};
  // A bridge that moves HTR only to the wallet's own address gets no other: the field holds it.
  const ownOnly = Boolean(bridge?.ownAddressOnly);
  const [typedAddress, setAddress] = useState(prefill.toAddress ?? '');
  const address = ownOnly ? (ownAddress ?? '') : typedAddress;
  const [addressError, setAddressError] = useState(null);
  const [amountText, setAmountText] = useState(
    prefill.amount ? plainAmount(BigInt(prefill.amount), decimalPlaces) : '',
  );
  const [amount, setAmount] = useState(prefill.amount ? BigInt(prefill.amount) : null);
  const [amountError, setAmountError] = useState(null);
  const [swapNote, setSwapNote] = useState(null);
  const addressRef = useRef(null);
  const from = CHAIN.HATHOR;
  const to = CHAIN.HATHOR_NEXT;
  const canSwap = canTransfer(config, to, from);

  if (!bridge) {
    return null;
  }

  const quote = bridge.quote({ from, to, amount: amount ?? 0n, available });
  const network = new Network(networkName);
  const render = (value) => `${renderValue(value, false, decimalPlaces)} ${symbol}`;

  const fillOwnAddress = () => {
    setAddress(ownAddress);
    setAddressError(null);
  };

  // Only one way exists so far: the swap button says the other isn't there yet.
  const onSwap = () => {
    if (!canSwap) {
      const source = CHAIN_NAME[to];
      const destination = CHAIN_NAME[from];
      setSwapNote(t`Transfers from ${source} to ${destination} aren't available yet.`);
    }
  };

  const onAmountChange = (text, value) => {
    setAmountText(text);
    setAmount(value);
    setAmountError(null);
  };

  const onContinue = () => {
    const validation = validateTransferAddress(address, network, to);
    if (!validation.isValid) {
      setAddressError(validation.message);
      return;
    }
    if (!amount || amount < quote.min) {
      const minimum = render(quote.min);
      setAmountError(t`The smallest transfer is ${minimum}.`);
      return;
    }
    if (amount > quote.max) {
      setAmountError(t`Insufficient funds`);
      return;
    }
    navigation.navigate('ChainTransferConfirm', {
      from,
      to,
      tokenId: HTR_UID,
      amount: amount.toString(),
      toAddress: address.trim(),
    });
  };

  const receive = renderNextValue(quote.receiveAmount, decimalPlaces);
  const availableText = render(available);

  return (
    <View style={styles.wrapper}>
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} accessible={false}>
        <HathorHeader
          withBorder
          title={t`TRANSFER BETWEEN CHAINS`}
          onBackPress={() => navigation.goBack()}
        />
        <KeyboardAvoidingView
          behavior='padding'
          style={{ flex: 1 }}
          keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}
        >
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps='handled'>
            <SimulatedTagIfMock />
            <View style={styles.fixedRow}>
              <Text style={styles.fixedLabel}>{t`From`}</Text>
              <ChainTag chain={from} />
            </View>
            <Pressable
              style={[styles.swap, !canSwap && styles.swapDimmed]}
              onPress={onSwap}
              accessibilityRole='button'
              accessibilityLabel={t`Swap From and To`}
            >
              <Text style={styles.swapText}>⇅</Text>
            </Pressable>
            {swapNote && <Text style={styles.note}>{swapNote}</Text>}
            <View style={styles.fixedRow}>
              <Text style={styles.fixedLabel}>{t`To`}</Text>
              <ChainTag chain={to} />
            </View>
            <View style={styles.fixedRow}>
              <Text style={styles.fixedLabel}>{t`Token`}</Text>
              <Text style={styles.fixedValue}>{t`${symbol} · ${availableText} available`}</Text>
            </View>

            <Text style={styles.label}>
              {ownOnly ? t`Your Hathor Next address` : t`Hathor Next address`}
            </Text>
            <Pressable
              onPress={() => !ownOnly && addressRef.current?.focus()}
              style={[styles.inputCard, addressError && styles.inputCardError]}
            >
              <TextInput
                ref={addressRef}
                style={styles.addressInput}
                value={address}
                editable={!ownOnly}
                onChangeText={(text) => {
                  setAddress(text);
                  setAddressError(null);
                }}
                placeholder={t`Paste or type a Hathor Next address`}
                placeholderTextColor='#9CA3AF'
                autoCorrect={false}
                spellCheck={false}
                autoCapitalize='none'
                multiline
                textAlignVertical='top'
                scrollEnabled={false}
              />
            </Pressable>
            {addressError && <Text style={styles.error}>{addressError}</Text>}
            {ownAddress && !ownOnly && (
              <View style={styles.linkRow}>
                <Text style={styles.link} onPress={fillOwnAddress} accessibilityRole='button'>
                  {t`Use my Hathor Next address`}
                </Text>
              </View>
            )}

            <Text style={styles.label}>{t`Amount`}</Text>
            <View style={styles.amountRow}>
              <AmountTextInput
                onAmountUpdate={onAmountChange}
                value={amountText}
                decimalPlaces={decimalPlaces}
                style={{ flex: 1 }}
              />
              <Text style={styles.amountSymbol}>{symbol}</Text>
            </View>
            {amountError && <Text style={styles.error}>{amountError}</Text>}

            <View style={styles.summary}>
              <SummaryRow
                label={t`You'll receive`}
                value={`${receive} ${transferReceiveSymbol(config, symbol)}`}
                strong
              />
              <SummaryRow label={t`Bridge fee`} value={render(quote.bridgeFee)} />
              <SummaryRow label={t`Network fee`} value={render(quote.networkFee)} />
              <SummaryRow label={t`Arrives in`} value={arrivalText(quote.etaSeconds)} />
            </View>
            <Text style={styles.oneWay}>
              {t`One-way: you can't move these tokens back to Hathor Network yet.`}
            </Text>
          </ScrollView>
          <View style={styles.footer}>
            <NewHathorButton
              title={t`Continue`}
              disabled={!address || !amount}
              onPress={onContinue}
            />
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </Pressable>
    </View>
  );
}

/**
 * A line of a transfer's summary.
 */
export const SummaryRow = ({ label, value, strong = false }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  body: {
    padding: 16,
    paddingBottom: 32,
  },
  fixedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  fixedLabel: {
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  fixedValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
  label: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  inputCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    minHeight: 80,
  },
  inputCardError: {
    borderColor: '#E55B5B',
  },
  addressInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 16,
    color: COLORS.textColor,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
  },
  error: {
    color: '#E55B5B',
    fontSize: 12,
    marginTop: 6,
  },
  swap: {
    alignSelf: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderColor,
  },
  swapDimmed: {
    opacity: 0.4,
  },
  swapText: {
    fontSize: 16,
    color: COLORS.textColor,
  },
  note: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: COLORS.textColorShadow,
  },
  linkRow: {
    marginTop: 10,
    minHeight: 20,
    alignItems: 'flex-start',
  },
  link: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountSymbol: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textColorShadow,
  },
  summary: {
    marginTop: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.lowContrastDetail,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.textColor,
  },
  summaryStrong: {
    fontWeight: 'bold',
  },
  oneWay: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textColor,
  },
  footer: {
    padding: 16,
  },
});
