/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from 'ttag';
import BackdropModal from '../BackdropModal';
import { ChevronDownIcon } from '../Icons/ChevronDown.icon';
import { CHAIN_NAME } from '../../multichain/chains';
import { HISTORY_VIEW } from '../../multichain/history';
import { COLORS } from '../../styles/themes';
import { ChainMark } from './ChainTag';

/**
 * A view's name: all chains, or the chain's.
 *
 * @param {string} view One of HISTORY_VIEW
 * @returns {string}
 */
export const historyViewName = (view) => (
  view === HISTORY_VIEW.ALL ? t`All chains` : CHAIN_NAME[view]
);

/**
 * The token screen's choice of chain: a small chip with the view shown, which opens a sheet of
 * the views, each with the token's balance there.
 *
 * @param {Object} props
 * @param {string} props.view One of HISTORY_VIEW
 * @param {{ view: string, balance: string }[]} props.options The views, with each balance as shown
 * @param {Function} props.onChange Called with the view picked
 */
export const ChainFilter = ({ view, options, onChange }) => {
  const [open, setOpen] = useState(false);

  const viewName = historyViewName(view);

  const pick = (picked) => {
    setOpen(false);
    onChange(picked);
  };

  return (
    <>
      <Pressable
        style={styles.chip}
        onPress={() => setOpen(true)}
        accessibilityRole='button'
        accessibilityLabel={t`Chain: ${viewName}`}
      >
        {view !== HISTORY_VIEW.ALL && <ChainMark chain={view} style={styles.chipMark} />}
        <Text style={styles.chipText}>{viewName}</Text>
        <ChevronDownIcon size={14} color={COLORS.textColorShadow} />
      </Pressable>
      <BackdropModal
        visible={open}
        onDismiss={() => setOpen(false)}
        animationType='slide'
        position='bottom'
        containerStyle={styles.modalWrapper}
        contentStyle={styles.modalContent}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>{t`Chain`}</Text>
          {options.map((option, index) => (
            <View key={option.view}>
              {index > 0 && <View style={styles.divider} />}
              <Pressable
                style={styles.row}
                onPress={() => pick(option.view)}
                accessibilityRole='button'
                accessibilityState={{ selected: option.view === view }}
              >
                <View style={styles.rowName}>
                  {option.view !== HISTORY_VIEW.ALL && (
                    <ChainMark chain={option.view} style={styles.rowMark} />
                  )}
                  <Text style={styles.rowTitle}>{historyViewName(option.view)}</Text>
                </View>
                <Text style={styles.rowBalance}>{option.balance}</Text>
                <Text style={styles.check}>{option.view === view ? '✓' : ''}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </BackdropModal>
    </>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderColor,
    backgroundColor: COLORS.backgroundColor,
  },
  chipMark: {
    marginRight: 5,
  },
  chipText: {
    marginRight: 4,
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
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
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  rowName: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMark: {
    marginRight: 8,
  },
  rowTitle: {
    fontSize: 15,
    color: COLORS.textColor,
  },
  rowBalance: {
    fontSize: 15,
    color: COLORS.textColor,
  },
  check: {
    width: 24,
    textAlign: 'right',
    fontSize: 16,
    color: COLORS.primary,
  },
});
