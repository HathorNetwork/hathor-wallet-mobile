/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from 'ttag';
import BackdropModal from '../BackdropModal';
import TokenBox from '../TokenBox';
import { COLORS } from '../../styles/themes';
import { NativeTag } from './NativeTag';

/**
 * The token a Hathor Next payment sends: a box with its symbol, as Hathor Network's Send has,
 * which opens a sheet of the tokens the wallet holds on Hathor Next, each with its balance. Token
 * symbols aren't unique on Hathor Next, so each row also names the token, and its short id
 * (idTag) whole after a name cut to the row: a long name never hides it. A native token, which
 * has no id there, is marked by a NativeTag.
 *
 * @param {Object} props
 * @param {string} props.tokenId The token picked
 * @param {string} props.symbol Its symbol
 * @param {{
 *   id: string,
 *   symbol: string,
 *   name: string,
 *   plainName?: string,
 *   idTag?: string|null,
 *   native?: boolean,
 *   balance: string,
 * }[]} props.options
 * @param {Function} props.onChange Called with the id of the token picked
 */
export const NextTokenPicker = ({ tokenId, symbol, options, onChange }) => {
  const [open, setOpen] = useState(false);

  // The amount field keeps the keyboard up, and it would cover the sheet.
  const openSheet = () => {
    Keyboard.dismiss();
    setOpen(true);
  };

  const pick = (id) => {
    setOpen(false);
    onChange(id);
  };

  return (
    <>
      <TokenBox onPress={openSheet} label={symbol} />
      <BackdropModal
        visible={open}
        onDismiss={() => setOpen(false)}
        animationType='slide'
        position='bottom'
        containerStyle={styles.modalWrapper}
        contentStyle={styles.modalContent}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>{t`Token`}</Text>
          {options.map((option, index) => (
            <View key={option.id}>
              {index > 0 && <View style={styles.divider} />}
              <Pressable
                style={styles.row}
                onPress={() => pick(option.id)}
                accessibilityRole='button'
                accessibilityState={{ selected: option.id === tokenId }}
              >
                <View style={styles.rowName}>
                  <View style={styles.rowSymbolLine}>
                    <Text style={styles.rowSymbol}>{option.symbol}</Text>
                    {option.native && <NativeTag style={styles.nativeTag} />}
                  </View>
                  {option.idTag ? (
                    <View style={styles.rowTitleLine}>
                      <Text style={[styles.rowTitle, styles.rowTitleName]} numberOfLines={1}>
                        {option.plainName}
                      </Text>
                      <Text style={styles.rowTitle}>{` · ${option.idTag}`}</Text>
                    </View>
                  ) : (
                    <Text style={styles.rowTitle} numberOfLines={1}>{option.name}</Text>
                  )}
                </View>
                <Text style={styles.rowBalance}>{option.balance}</Text>
                <Text style={styles.check}>{option.id === tokenId ? '✓' : ''}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </BackdropModal>
    </>
  );
};

const styles = StyleSheet.create({
  modalWrapper: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  modalContent: {
    padding: 0,
    borderRadius: 16,
  },
  sheet: {
    paddingVertical: 16,
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 16,
  },
  title: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textColorShadow,
  },
  divider: {
    height: 1,
    marginHorizontal: 24,
    backgroundColor: COLORS.borderColor,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  rowName: {
    flex: 1,
    marginRight: 12,
  },
  rowSymbolLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nativeTag: {
    marginLeft: 6,
  },
  rowSymbol: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
  rowTitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textColorShadow,
  },
  rowTitleLine: {
    flexDirection: 'row',
    minWidth: 0,
  },
  rowTitleName: {
    flexShrink: 1,
  },
  rowBalance: {
    fontSize: 14,
    color: COLORS.textColor,
  },
  check: {
    width: 24,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});
