/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet } from 'react-native';

import FeeBreakdown from './Shielded/FeeBreakdown';
import { COLORS } from '../styles/themes';

/**
 * The fees row of the tx details: the fees of the tx, between the rows of the details list,
 * which a border separates.
 *
 * @param {Object} props
 * @param {{ total: bigint, network: bigint, privacy: bigint }} props.fees From getTxFees
 * @param {string} props.symbol The network's native token symbol
 * @param {number} props.decimalPlaces
 * @param {string} props.amountFormat
 */
export default function TxFeesRow({
  fees,
  symbol,
  decimalPlaces,
  amountFormat,
}) {
  return (
    <FeeBreakdown
      total={fees.total}
      network={fees.network}
      privacy={fees.privacy}
      symbol={symbol}
      decimalPlaces={decimalPlaces}
      amountFormat={amountFormat}
      style={styles.row}
      breakdownStyle={styles.breakdown}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    borderColor: COLORS.borderColor,
    borderBottomWidth: 1,
  },
  // The expanded fees get as much room above as below them.
  breakdown: {
    paddingTop: 8,
  },
});
