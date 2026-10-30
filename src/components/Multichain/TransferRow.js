/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import moment from 'moment';
import { t } from 'ttag';
import IconTabBar from '../../icon-font';
import { CHAIN, CHAIN_NAME, NEXT_COLORS } from '../../multichain/chains';
import { renderNextValue } from '../../multichain/amount';
import { HISTORY_ROW } from '../../multichain/history';
import { TRANSFER_STATUS } from '../../multichain/state';
import { renderValue } from '../../utils';
import { COLORS } from '../../styles/themes';
import { SimulatedTag } from './SimulatedTag';

/**
 * How long a transfer on its way still takes, as the screens say it.
 *
 * @param {number} arriveAt Unix ms, the estimate
 * @param {number} [now] Unix ms
 * @returns {string}
 */
export function arrivingText(arriveAt, now = Date.now()) {
  const minutes = Math.max(1, Math.ceil((arriveAt - now) / 60000));
  return t`Arriving in about ${minutes} min`;
}

/**
 * An amount of one chain as text, each chain's way.
 *
 * @param {bigint} amount In the chain's units
 * @param {string} chain One of CHAIN
 * @param {number} hathorDecimalPlaces
 * @param {string} [amountFormat]
 * @returns {string}
 */
export const renderChainValue = (amount, chain, hathorDecimalPlaces, amountFormat) => (
  chain === CHAIN.HATHOR
    ? renderValue(amount, false, hathorDecimalPlaces, amountFormat)
    : renderNextValue(amount, hathorDecimalPlaces, amountFormat)
);

/**
 * What a transfer's row says it is, as one row (all chains) or as its side on one chain. A
 * transfer to the wallet's own address moved the money; one to another address sent it.
 *
 * @param {Object} transfer TransferRecord
 * @param {string} kind HISTORY_ROW.TRANSFER, TRANSFER_SOURCE or TRANSFER_DESTINATION
 * @returns {string}
 */
export function transferTitle(transfer, kind) {
  const destination = CHAIN_NAME[transfer.to];
  if (kind === HISTORY_ROW.TRANSFER_DESTINATION) {
    const source = CHAIN_NAME[transfer.from];
    return t`Transfer from ${source}`;
  }
  if (kind === HISTORY_ROW.TRANSFER && transfer.toOwn) {
    return t`Moved to ${destination}`;
  }
  return t`Transferred to ${destination}`;
}

/**
 * What a transfer's row changes, signed, in the units of the chain it shows on: the fees for a
 * transfer between the wallet's own addresses on all chains, everything that left the source
 * chain on its side, and what arrived on the destination's.
 *
 * @param {Object} transfer TransferRecord
 * @param {string} kind One of HISTORY_ROW's transfer kinds
 * @returns {{ amount: bigint, incoming: boolean }}
 */
export function transferChange(transfer, kind) {
  if (kind === HISTORY_ROW.TRANSFER_DESTINATION) {
    return { amount: BigInt(transfer.receiveAmount), incoming: true };
  }
  const networkFee = BigInt(transfer.networkFee);
  if (kind === HISTORY_ROW.TRANSFER && transfer.toOwn) {
    return { amount: BigInt(transfer.bridgeFee) + networkFee, incoming: false };
  }
  return { amount: BigInt(transfer.amount) + networkFee, incoming: false };
}

/**
 * A transfer between chains in a token's history.
 *
 * @param {Object} props
 * @param {Object} props.transfer TransferRecord
 * @param {string} props.kind One of HISTORY_ROW's transfer kinds
 * @param {string} props.symbol The token's symbol
 * @param {number} props.hathorDecimalPlaces
 * @param {string} [props.amountFormat]
 * @param {Function} props.onPress Called with the transfer
 */
export const TransferRow = ({
  transfer,
  kind,
  symbol,
  hathorDecimalPlaces,
  amountFormat,
  onPress,
}) => {
  const { amount, incoming } = transferChange(transfer, kind);
  const shownChain = kind === HISTORY_ROW.TRANSFER_DESTINATION ? transfer.to : transfer.from;
  const shown = renderChainValue(amount, shownChain, hathorDecimalPlaces, amountFormat);
  const signed = `${incoming ? '' : '-'}${shown}`;
  const pending = transfer.status === TRANSFER_STATUS.PENDING;
  const moved = renderChainValue(
    BigInt(transfer.amount),
    transfer.from,
    hathorDecimalPlaces,
    amountFormat,
  );
  // The source side of a simulated transfer stands for a transaction that was never broadcast.
  const simulatedSide = kind === HISTORY_ROW.TRANSFER_SOURCE && !transfer.debitedOnSource;

  return (
    <TouchableHighlight onPress={() => onPress(transfer)} underlayColor={COLORS.primaryOpacity30}>
      <View style={styles.row}>
        <IconTabBar
          style={styles.icon}
          color={incoming ? COLORS.positiveBalanceColor : COLORS.textColor}
          size={24}
          name={incoming ? 'icReceive' : 'icSend'}
        />
        <View style={styles.middle}>
          <Text style={styles.title} numberOfLines={1}>{transferTitle(transfer, kind)}</Text>
          {kind === HISTORY_ROW.TRANSFER && transfer.toOwn && (
            <Text style={styles.secondary}>{t`${moved} ${symbol} moved`}</Text>
          )}
          {pending && kind !== HISTORY_ROW.TRANSFER_SOURCE ? (
            <Text style={[styles.secondary, styles.pending]}>
              {arrivingText(transfer.arriveAt)}
            </Text>
          ) : (
            <Text style={styles.secondary}>{moment(transfer.sentAt).calendar()}</Text>
          )}
          {simulatedSide && <SimulatedTag style={styles.simulated} />}
        </View>
        <Text style={[styles.amount, incoming && styles.positive]} numberOfLines={1}>
          {signed}
        </Text>
      </View>
    </TouchableHighlight>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 80,
    paddingVertical: 24,
  },
  icon: {
    marginLeft: 16,
    marginRight: 16,
    width: 24,
    height: 24,
  },
  middle: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 'bold',
  },
  secondary: {
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.textColorShadow,
  },
  pending: {
    color: NEXT_COLORS.accentText,
    fontWeight: 'bold',
  },
  simulated: {
    marginTop: 4,
  },
  amount: {
    fontSize: 16,
    marginRight: 16,
    marginLeft: 8,
    maxWidth: '45%',
    textAlign: 'right',
  },
  positive: {
    color: COLORS.positiveBalanceColor,
    fontWeight: 'bold',
  },
});
