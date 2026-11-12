/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { utf8ToBytes } from '@noble/hashes/utils';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import SimpleInput from '../../components/SimpleInput';
import AmountTextInput from '../../components/AmountTextInput';
import InputLabel from '../../components/InputLabel';
import OfflineBar from '../../components/OfflineBar';
import { SyncingNotice } from '../../components/Multichain/SyncingNotice';
import { NEXT_DECIMAL_PLACES } from '../../multichain/chains';
import { renderNextValue } from '../../multichain/amount';
import { syncingSendBody } from '../../multichain/content';
import { selectSideChainConfig } from '../../multichain/gating';
import { getKeyboardAvoidingViewTopDistance } from '../../utils';
import { useNavigation } from '../../hooks/navigation';
import { COLORS } from '../../styles/themes';
import { selectNextSendFee } from './NextSendAmountInput';

/**
 * The longest symbol and name, as the Hathor Next wallet and its web wallet take them, and the
 * protocol's caps in bytes, which an accented name reaches before its characters do.
 */
export const MAX_SYMBOL = 12;
export const MAX_NAME = 48;
const MAX_SYMBOL_BYTES = 16;
const MAX_NAME_BYTES = 64;

/**
 * What creating a token on Hathor Next makes public: everything about it, by the protocol. A
 * creation's outputs are transparent and paid to the creator's spend key, which is half of the
 * address, so they also show who created the token.
 */
export function publicTokenNote() {
  return t`Creating a token is public. Its name, its symbol, the amount you create and what comes back to you from the fee go on Hathor Next in the clear, paid openly to your address: anyone who knows your Hathor Next address can see the tokens you created.`;
}

/**
 * Where the token's mint and melt powers live: the words, not the phone.
 */
export function tokenKeysNote() {
  return t`The keys that let you create more of this token, or destroy some, come from your recovery words: this wallet holds them on any device you restore it to, and they never leave it. There is nothing more to back up.`;
}

/**
 * Why the form can't go on, in the user's terms, or null.
 *
 * @param {{ name: string, symbol: string, amount: bigint|null }} form
 * @returns {string|null}
 */
export function tokenFormError({ name, symbol, amount }) {
  if (symbol && !/^[A-Z0-9]*$/.test(symbol)) {
    return t`Symbols use letters and numbers only.`;
  }
  if (symbol && (symbol.length < 2 || utf8ToBytes(symbol).length > MAX_SYMBOL_BYTES)) {
    return t`A symbol has 2 to ${MAX_SYMBOL} letters or numbers.`;
  }
  if (name && (name.trim() !== name || utf8ToBytes(name).length > MAX_NAME_BYTES)) {
    return t`The name can't start or end with a space, nor be this long.`;
  }
  if (amount !== null && amount <= 0n) {
    return t`Invalid amount`;
  }
  return null;
}

/**
 * Creating a token on Hathor Next: its name, symbol and the amount created, all of it paid to
 * this wallet. Its mint and melt keys are this wallet's, derived from the words, so it can mint
 * and melt it later from any device it is restored to.
 */
export default function NextCreateTokenScreen() {
  const navigation = useNavigation();
  const config = useSelector(selectSideChainConfig);
  const fee = useSelector(selectNextSendFee);
  const sweeping = useSelector((state) => state.multichain.next.sweeping);
  const nativeTokenId = config?.nativeTokenId;
  const nativeAvailable = useSelector(
    (state) => state.multichain.next.balances[nativeTokenId]?.data?.available ?? 0n,
  );
  const hathorDecimalPlaces = useSelector((state) => state.serverInfo?.decimal_places ?? 2);
  const nativeSymbol = config?.nativeTokenSymbol ?? 'HTR';
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [amountText, setAmountText] = useState('');
  const [amount, setAmount] = useState(null);
  const [error, setError] = useState(null);

  const feeText = renderNextValue(fee, hathorDecimalPlaces);
  const formError = tokenFormError({ name, symbol, amount });
  const ready = name.length > 0 && symbol.length > 0 && amount !== null && amount > 0n
    && !formError && !sweeping;

  const onNext = () => {
    if (!ready) {
      return;
    }
    if (fee > nativeAvailable) {
      setError(t`The network fee is paid in ${nativeSymbol}. You need ${feeText} ${nativeSymbol} on Hathor Next.`);
      return;
    }
    navigation.navigate('NextCreateTokenConfirm', {
      name,
      symbol,
      amount: amount.toString(),
    });
  };

  return (
    <View style={styles.wrapper}>
      <HathorHeader
        withBorder
        title={t`CREATE TOKEN`}
        onBackPress={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        behavior='padding'
        style={{ flex: 1 }}
        keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps='handled'>
          <Pressable onPress={() => Keyboard.dismiss()}>
            <Text style={styles.chain}>{t`On Hathor Next`}</Text>
            <SimpleInput
              label={t`Token name`}
              autoFocus
              subtitle={t`${name.length}/${MAX_NAME} characters`}
              onChangeText={(text) => {
                setName(text.slice(0, MAX_NAME));
                setError(null);
              }}
              value={name}
            />
            <View style={styles.gap} />
            <SimpleInput
              label={t`Token symbol`}
              autoCapitalize='characters'
              subtitle={t`${symbol.length}/${MAX_SYMBOL} letters or numbers`}
              // Uppercased as it is typed; anything else is refused in words below, never
              // dropped under the cursor.
              onChangeText={(text) => {
                setSymbol(text.toUpperCase().slice(0, MAX_SYMBOL));
                setError(null);
              }}
              value={symbol}
            />
            <Text style={styles.hint}>
              {t`Symbols aren't unique: anyone can create a token with the same letters. A token is told apart by its id.`}
            </Text>
            <View style={styles.gap} />
            <InputLabel>{t`Amount to create`}</InputLabel>
            <View style={styles.amountRow}>
              <AmountTextInput
                onAmountUpdate={(text, value) => {
                  setAmountText(text);
                  setAmount(value);
                  setError(null);
                }}
                value={amountText}
                decimalPlaces={NEXT_DECIMAL_PLACES}
                style={{ flex: 1 }}
              />
              <Text style={styles.symbol}>{symbol}</Text>
            </View>
            <Text style={styles.fee}>{t`Network fee: ${feeText} ${nativeSymbol}`}</Text>
            {sweeping && <SyncingNotice text={syncingSendBody()} style={styles.syncing} />}
            <Text style={styles.error}>{error ?? formError}</Text>
            <View style={styles.note}>
              <Text style={styles.noteText}>{publicTokenNote()}</Text>
            </View>
            <View style={styles.note}>
              <Text style={styles.noteText}>{tokenKeysNote()}</Text>
            </View>
          </Pressable>
        </ScrollView>
        <View style={styles.footer}>
          <NewHathorButton title={t`Next`} disabled={!ready} onPress={onNext} />
        </View>
        <OfflineBar style={{ position: 'relative' }} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  body: {
    padding: 16,
    paddingBottom: 32,
  },
  chain: {
    marginBottom: 16,
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  gap: {
    height: 16,
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.textColorShadow,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbol: {
    marginLeft: 8,
    fontSize: 24,
    color: COLORS.textColor,
  },
  fee: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.textColorShadow,
  },
  syncing: {
    marginTop: 12,
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.errorTextColor,
  },
  note: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.lowContrastDetail,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textColor,
  },
  footer: {
    padding: 16,
  },
});
