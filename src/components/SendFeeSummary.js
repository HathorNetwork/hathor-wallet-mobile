/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from 'ttag';

import BackdropModal from './BackdropModal';
import FeeBreakdown from './Shielded/FeeBreakdown';
import { COLORS } from '../styles/themes';

/**
 * The fees of a send that pays a privacy fee, in its summary: the total, which expands into the
 * network fee and the privacy fee with the count of private outputs, and an info sheet that
 * says what the privacy fee pays for.
 *
 * @param {Object} props
 * @param {{ total: bigint, network: bigint, privacy: bigint, privateOutputs: number }} props.fees
 *   The fees of the prepared send, from computeSendFees
 * @param {string} props.symbol The network's native token symbol
 * @param {number} props.decimalPlaces
 * @param {string} props.amountFormat
 */
export default function SendFeeSummary({
  fees,
  symbol,
  decimalPlaces,
  amountFormat,
}) {
  const [isInfoShown, setIsInfoShown] = useState(false);

  return (
    <View style={styles.wrapper}>
      <FeeBreakdown
        total={fees.total}
        network={fees.network}
        privacy={fees.privacy}
        privateOutputs={fees.privateOutputs}
        symbol={symbol}
        decimalPlaces={decimalPlaces}
        amountFormat={amountFormat}
        rowStyle={styles.row}
        labelStyle={styles.label}
        valueStyle={styles.value}
        breakdownStyle={styles.breakdown}
        onInfoPress={() => setIsInfoShown(true)}
      />
      <BackdropModal
        visible={isInfoShown}
        onDismiss={() => setIsInfoShown(false)}
        animationType='slide'
        position='bottom'
      >
        <View style={styles.infoSheet}>
          <Text style={styles.infoTitle}>{t`Transaction fees`}</Text>
          <Text style={styles.infoBody}>
            {t`A transaction pays a network fee, and a privacy fee for each private output it creates, the wallet's private change included. A send that spends private funds keeps its change private, so it can pay a privacy fee even when the payment is public.`}
          </Text>
        </View>
      </BackdropModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  // The paddings of the other rows of the send summary, with their bold label.
  row: {
    height: 'auto',
    padding: 10,
  },
  label: {
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
  value: {
    fontSize: 14,
  },
  breakdown: {
    paddingLeft: 10,
    paddingRight: 10,
  },
  infoSheet: {
    padding: 24,
    paddingBottom: 32,
    backgroundColor: COLORS.backgroundColor,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textColor,
    marginBottom: 8,
  },
  infoBody: {
    fontSize: 14,
    color: COLORS.textColor,
    lineHeight: 20,
  },
});
