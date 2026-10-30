/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import { t } from 'ttag';
import BackdropModal from '../BackdropModal';
import CopyClipboard from '../CopyClipboard';
import { ChainTag } from './ChainTag';
import { SimulatedTagIfMock } from './SimulatedTag';
import { arrivingText, renderChainValue, transferTitle } from './TransferRow';
import { CHAIN_NAME, NEXT_COLORS } from '../../multichain/chains';
import { HISTORY_ROW } from '../../multichain/history';
import { TRANSFER_STATUS } from '../../multichain/state';
import { COLORS } from '../../styles/themes';

/**
 * One step of a transfer: a transaction on one chain, with its status.
 *
 * @param {Object} props
 * @param {number} props.index
 * @param {string} props.title
 * @param {string} props.amount Signed, with the symbol
 * @param {string} props.status
 * @param {boolean} [props.pending]
 * @param {string|null} [props.txId]
 */
const Step = ({ index, title, amount, status, pending = false, txId = null }) => (
  <View style={styles.step}>
    <View style={[styles.stepNumber, pending && styles.stepNumberPending]}>
      <Text style={styles.stepNumberText}>{index}</Text>
    </View>
    <View style={styles.stepBody}>
      <View style={styles.stepHead}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepAmount}>{amount}</Text>
      </View>
      <Text style={[styles.stepStatus, pending && styles.pending]}>{status}</Text>
      {txId && <CopyClipboard text={txId} textStyle={styles.copyText} />}
    </View>
  </View>
);

/**
 * A transfer between chains, opened from any of its rows: one transfer with its two steps, the
 * transaction that left one chain and the one that reached the other, with the address and the
 * fees.
 *
 * @param {Object} props
 * @param {Object|null} props.transfer TransferRecord, or null for none
 * @param {string} props.symbol
 * @param {number} props.hathorDecimalPlaces
 * @param {Function} props.onDismiss
 */
export const TransferDetailsModal = ({ transfer, symbol, hathorDecimalPlaces, onDismiss }) => {
  if (!transfer) {
    return null;
  }
  const pending = transfer.status === TRANSFER_STATUS.PENDING;
  const source = CHAIN_NAME[transfer.from];
  const destination = CHAIN_NAME[transfer.to];
  const onSource = (amount) => renderChainValue(amount, transfer.from, hathorDecimalPlaces);
  const sent = onSource(BigInt(transfer.amount) + BigInt(transfer.networkFee));
  const received = renderChainValue(
    BigInt(transfer.receiveAmount),
    transfer.to,
    hathorDecimalPlaces,
  );
  const bridgeFee = onSource(BigInt(transfer.bridgeFee));
  const networkFee = onSource(BigInt(transfer.networkFee));
  const arrivedAt = moment(transfer.arriveAt).format('lll');
  const usualMinutes = Math.max(1, Math.round((transfer.arriveAt - transfer.sentAt) / 60000));

  return (
    <BackdropModal
      visible
      onDismiss={onDismiss}
      animationType='slide'
      position='bottom'
      containerStyle={styles.modalWrapper}
      contentStyle={styles.modalContent}
    >
      <View style={styles.sheet}>
        <View style={styles.tags}>
          <ChainTag chain={transfer.from} />
          <Text style={styles.arrow}>→</Text>
          <ChainTag chain={transfer.to} />
          <SimulatedTagIfMock style={styles.simulated} />
        </View>
        <Text style={styles.title}>{transferTitle(transfer, HISTORY_ROW.TRANSFER)}</Text>
        <Text style={styles.date}>{moment(transfer.sentAt).format('lll')}</Text>
        <Step
          index={1}
          title={t`Sent on ${source}`}
          amount={`-${sent} ${symbol}`}
          status={t`Done`}
          txId={transfer.sourceTxId}
        />
        <Step
          index={2}
          title={t`Received on ${destination}`}
          amount={`+${received} ${symbol}`}
          status={pending
            ? `${arrivingText(transfer.arriveAt)} · ${t`Usually about ${usualMinutes} min`}`
            : t`Done · ${arrivedAt}`}
          pending={pending}
        />
        <Text style={styles.label}>{t`To`}</Text>
        {transfer.toOwn && <Text style={styles.value}>{t`Your ${destination} address`}</Text>}
        <CopyClipboard text={transfer.toAddress} textStyle={styles.copyText} />
        <Text style={styles.label}>{t`Bridge fee`}</Text>
        <Text style={styles.value}>{`${bridgeFee} ${symbol}`}</Text>
        <Text style={styles.label}>{t`Network fee`}</Text>
        <Text style={styles.value}>{`${networkFee} ${symbol}`}</Text>
      </View>
    </BackdropModal>
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
    padding: 24,
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 16,
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  arrow: {
    marginHorizontal: 6,
    color: COLORS.textColorShadow,
  },
  simulated: {
    marginLeft: 8,
  },
  title: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
  date: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textColorShadow,
  },
  step: {
    flexDirection: 'row',
    marginTop: 16,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  stepNumberPending: {
    backgroundColor: NEXT_COLORS.accent,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.backgroundColor,
  },
  stepBody: {
    flex: 1,
    marginLeft: 10,
  },
  stepHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
  stepAmount: {
    fontSize: 14,
    color: COLORS.textColor,
  },
  stepStatus: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textColorShadow,
  },
  pending: {
    color: NEXT_COLORS.accentText,
  },
  label: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textColorShadow,
  },
  value: {
    marginTop: 2,
    fontSize: 14,
    color: COLORS.textColor,
  },
  copyText: {
    fontSize: 12,
  },
});
