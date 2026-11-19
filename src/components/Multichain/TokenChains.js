/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { msgid, ngettext, t } from 'ttag';
import { NEXT_COLORS } from '../../multichain/chains';
import { renderHomeValue } from '../../utils';
import { COLORS } from '../../styles/themes';
import { ChainMark } from './ChainTag';

/**
 * Where a row of the Dashboard's list of both chains lives, under its name: "2 chains" for a
 * token on both, with what is on its way to it, or the one chain's mark and name.
 *
 * @param {Object} props
 * @param {string[]} props.chains CHAIN values
 * @param {{ amount: bigint, decimalPlaces: number }|null} [props.arriving]
 * @param {string} [props.amountFormat]
 */
export const TokenChains = ({ chains, arriving = null, amountFormat }) => {
  if (chains.length === 1) {
    return <ChainMark chain={chains[0]} withName style={styles.line} />;
  }
  const count = chains.length;
  const arrivingText = arriving
    ? renderHomeValue(arriving.amount, false, arriving.decimalPlaces, amountFormat)
    : null;
  return (
    <View style={[styles.line, styles.row]}>
      <Text style={styles.text}>
        {ngettext(msgid`${count} chain`, `${count} chains`, count)}
      </Text>
      {arrivingText && (
        <Text style={[styles.text, styles.arriving]}>
          {` · ${t`${arrivingText} arriving`}`}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  line: {
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textColorShadow,
  },
  arriving: {
    color: NEXT_COLORS.accentText,
  },
});
