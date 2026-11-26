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
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import SimpleInput from '../../components/SimpleInput';
import AmountTextInput from '../../components/AmountTextInput';
import InputLabel from '../../components/InputLabel';
import OfflineBar from '../../components/OfflineBar';
import { SyncingNotice } from '../../components/Multichain/SyncingNotice';
import { NEXT_DECIMAL_PLACES } from '../../multichain/chains';
import { amountTextError, renderNextValue } from '../../multichain/amount';
import { syncingSendBody } from '../../multichain/content';
import { selectSideChainConfig } from '../../multichain/gating';
import { getKeyboardAvoidingViewTopDistance } from '../../utils';
import { useNavigation } from '../../hooks/navigation';
import { COLORS } from '../../styles/themes';
import { feeShortText, selectNextSendFee } from './NextSendAmountInput';

/**
 * The longest symbol and name, as the Hathor Next wallet and its web wallet take them, and the
 * protocol's caps in bytes, which an accented name reaches before its characters do.
 */
export const MAX_SYMBOL = 12;
export const MAX_NAME = 48;
const MAX_SYMBOL_BYTES = 16;
const MAX_NAME_BYTES = 64;

/**
 * A text's length in UTF-8 bytes, as the creation's body counts it. The app's Buffer (shim.js)
 * counts it: this screen loads at the app's start, and the Hathor Next kit's crypto library
 * mustn't run there.
 *
 * @param {string} text
 * @returns {number}
 */
export const utf8Length = (text) => Buffer.byteLength(text, 'utf8');
// The most of a token there can be: a u64, as the network's amounts are.
const MAX_SUPPLY = 2n ** 64n - 1n;
// HTR's own name and symbol: a token named after either could pass for it.
const HTR_NAMES = ['Hathor', 'HTR'];
// What a person can't see in a name, besides spaces: characters drawn as nothing (soft hyphen,
// zero widths, joiners, direction marks, fillers, variation selectors, tags), by code point.
const UNSEEN = [
  [0x00AD, 0x00AD], [0x034F, 0x034F], [0x061C, 0x061C], [0x115F, 0x1160], [0x17B4, 0x17B5],
  [0x180B, 0x180F], [0x200B, 0x200F], [0x202A, 0x202E], [0x2060, 0x206F], [0x3164, 0x3164],
  [0xFE00, 0xFE0F], [0xFEFF, 0xFEFF], [0xFFA0, 0xFFA0], [0xE0000, 0xE007F], [0xE0100, 0xE01EF],
];
const seen = (char) => {
  const code = char.codePointAt(0);
  return !/\s/.test(char) && !UNSEEN.some(([from, to]) => code >= from && code <= to);
};

/**
 * A name or symbol as a person reads it, to compare it with another: letter case, spaces, unseen
 * characters and the other widths of the same letters (NFKC: "Ｈａｔｈｏｒ" is "Hathor") don't tell
 * two apart.
 *
 * @param {string|null|undefined} text
 * @returns {string}
 */
export function asRead(text) {
  return [...(text ?? '').normalize('NFKC')].filter(seen).join('').toLowerCase();
}

/**
 * What creating a token on Hathor Next makes public: everything about it, by the protocol. A
 * creation's outputs are transparent and paid to the creator's spend key, which is half of the
 * address, so they also show who created the token.
 *
 * @param {string} feeSymbol The symbol of the token that pays the fee: the network's native token
 * @returns {string}
 */
export function publicTokenNote(feeSymbol) {
  // Each placeholder has a name of its own: ttag can't translate a message that repeats one.
  const changeSymbol = feeSymbol;
  return t`Creating a token is public. Its name, its symbol, the amount you create and the ${feeSymbol} that comes back to you as change from the fee go on Hathor Next in the clear, paid openly to your address: anyone who knows your Hathor Next address can see the tokens you created. You'll see how much ${changeSymbol} that is before the token is created.`;
}

/**
 * Where the token's mint and melt powers live: the words, not the phone.
 */
export function tokenKeysNote() {
  return t`The keys that let you create more of this token, or destroy some, come from your recovery words: this wallet holds them on any device you restore it to, and they never leave it. There is nothing more to back up.`;
}

/**
 * Why the form can't go on, in the user's terms, or null. A token can't take a native token's
 * name or symbol, HTR's or the side chain's own, as its name or as its symbol, however written.
 *
 * @param {{ name: string, symbol: string, amount: bigint|null }} form
 * @param {{ name?: string, symbol?: string }} [native] The side chain's native token
 * @returns {string|null}
 */
export function tokenFormError({ name, symbol, amount }, native = {}) {
  const taken = [...HTR_NAMES, native.name, native.symbol].map(asRead).filter(Boolean);
  if ([name, symbol].some((text) => taken.includes(asRead(text)))) {
    return t`This is a native token's name or symbol. Choose another, so your token can't be taken for it.`;
  }
  if (symbol && !/^[A-Z0-9]*$/.test(symbol)) {
    return t`Symbols use letters and numbers only.`;
  }
  if (symbol && (symbol.length < 2 || utf8Length(symbol) > MAX_SYMBOL_BYTES)) {
    return t`A symbol has 2 to ${MAX_SYMBOL} letters or numbers.`;
  }
  if (name && (name.trim() !== name || utf8Length(name) > MAX_NAME_BYTES)) {
    return t`The name can't start or end with a space, nor be this long.`;
  }
  if (amount !== null && amount <= 0n) {
    return t`Invalid amount`;
  }
  if (amount !== null && amount > MAX_SUPPLY) {
    return t`That is more than a token can have.`;
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
  // Counted as it is cut: by whole characters.
  const nameLength = [...name].length;
  const formError = tokenFormError(
    { name, symbol, amount },
    { name: config?.nativeTokenName, symbol: config?.nativeTokenSymbol },
  );
  const ready = name.length > 0 && symbol.length > 0 && amount !== null && amount > 0n
    && !formError && !sweeping;

  const onNext = () => {
    if (!ready) {
      return;
    }
    if (fee > nativeAvailable) {
      setError(feeShortText(feeText, nativeSymbol));
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
              subtitle={t`${nameLength}/${MAX_NAME} characters`}
              // Cut at a whole character: an emoji is two code units, never cut in half.
              onChangeText={(text) => {
                setName([...text].slice(0, MAX_NAME).join(''));
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
                  const textError = amountTextError(text);
                  setAmountText(text);
                  setAmount(textError ? null : value);
                  setError(textError);
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
              <Text style={styles.noteText}>{publicTokenNote(nativeSymbol)}</Text>
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
