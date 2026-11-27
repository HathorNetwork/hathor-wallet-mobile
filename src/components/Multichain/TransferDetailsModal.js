/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import moment from 'moment';
import { t } from 'ttag';
import BackdropModal from '../BackdropModal';
import CopyClipboard from '../CopyClipboard';
import { ChainTag } from './ChainTag';
import {
  arrivingText,
  progressText,
  renderChainValue,
  transferTitle,
  waitsForNext,
} from './TransferRow';
import { CHAIN, CHAIN_NAME, NEXT_COLORS, nextExplorerTxUrl } from '../../multichain/chains';
import { selectSideChainConfig } from '../../multichain/gating';
import { HISTORY_ROW } from '../../multichain/history';
import { TRANSFER_STATUS } from '../../multichain/state';
import { COLORS } from '../../styles/themes';
import { combineURLs } from '../../utils';

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
 * @param {string|null} [props.link] The transaction's page on its chain's explorer
 */
const Step = ({ index, title, amount, status, pending = false, txId = null, link = null }) => (
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
      {link && (
        <Text style={styles.link} onPress={() => Linking.openURL(link)}>
          {t`View on explorer`}
        </Text>
      )}
    </View>
  </View>
);

/**
 * A transfer between chains, opened from any of its rows: one transfer with its two steps, the
 * transaction that left one chain and the one that reached the other, each with its link to its
 * own chain's explorer, with the address and the fees.
 *
 * @param {Object} props
 * @param {Object|null} props.transfer TransferRecord, or null for none
 * @param {string} props.symbol
 * @param {number} props.hathorDecimalPlaces
 * @param {Function} props.onDismiss
 */
export const TransferDetailsModal = ({ transfer, symbol, hathorDecimalPlaces, onDismiss }) => {
  const hathorExplorerUrl = useSelector((state) => state.networkSettings.explorerUrl);
  const sideChainConfig = useSelector(selectSideChainConfig);
  if (!transfer) {
    return null;
  }
  // A transaction's page on the explorer of the chain it is on: Hathor Network's is the network
  // settings', Hathor Next's the side chain's.
  const explorerLinkOf = (chain, txId) => {
    if (!txId) {
      return null;
    }
    if (chain === CHAIN.HATHOR) {
      return hathorExplorerUrl ? combineURLs(hathorExplorerUrl, `transaction/${txId}`) : null;
    }
    return nextExplorerTxUrl(sideChainConfig, txId);
  };
  const mintTxId = transfer.progress?.mintTxId ?? null;
  const pending = transfer.status === TRANSFER_STATUS.PENDING;
  const failed = transfer.status === TRANSFER_STATUS.FAILED;
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
  // Held by the bridge with its confirmations done: no time to arrive can be given, and the
  // backend's reason, when it gives one, says why.
  const held = pending && waitsForNext(transfer.progress);
  // How long a transfer usually takes, as its bridge says: never the time this one has taken.
  const usualMinutes = Number.isFinite(transfer.usualMs)
    ? Math.max(1, Math.round(transfer.usualMs / 60000))
    : null;
  const usualText = usualMinutes === null ? null : t`Usually about ${usualMinutes} min`;

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
        </View>
        <Text style={styles.title}>{transferTitle(transfer, HISTORY_ROW.TRANSFER)}</Text>
        <Text style={styles.date}>{moment(transfer.sentAt).format('lll')}</Text>
        <Step
          index={1}
          title={t`Sent on ${source}`}
          amount={`-${sent} ${symbol}`}
          status={failed ? progressText({ stage: 'failed' }) : t`Done`}
          txId={transfer.sourceTxId}
          link={explorerLinkOf(transfer.from, transfer.sourceTxId)}
        />
        {!failed && (
        <Step
          index={2}
          title={t`Received on ${destination}`}
          amount={`+${received} ${symbol}`}
          status={pending
            ? [
              progressText(transfer.progress),
              held ? null : arrivingText(transfer.arriveAt),
              usualText,
            ].filter(Boolean).join(' · ')
            : t`Done · ${arrivedAt}`}
          pending={pending}
          txId={mintTxId}
          link={explorerLinkOf(transfer.to, mintTxId)}
        />
        )}
        {(failed || held) && transfer.reason && (
          <Text style={styles.value}>{transfer.reason}</Text>
        )}
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
  link: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});
