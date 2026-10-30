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
import NewHathorButton from '../NewHathorButton';
import { ChainTag } from './ChainTag';
import { SimulatedTagIfMock } from './SimulatedTag';
import { nextRowTitle } from './NextTxRow';
import { renderNextValue } from '../../multichain/amount';
import {
  finalitySentence,
  nextStatusLabel,
  rejectedBody,
  sendingBody,
  unconfirmedBody,
  verdictLead,
} from '../../multichain/content';
import { selectSideChainConfig } from '../../multichain/gating';
import { COLORS } from '../../styles/themes';

/**
 * What a status means, under the row's status. A refusal carries the network's own words.
 *
 * @param {Object} row
 * @returns {string|null}
 */
function statusExplanation(row) {
  switch (row.status) {
    case 'recorded':
      return finalitySentence();
    case 'pending':
      return sendingBody();
    case 'unconfirmed':
      return unconfirmedBody();
    case 'failed':
      return rejectedBody();
    default:
      return null;
  }
}

/**
 * A Hathor Next transaction's details: what it was, its status and what that means, when, and its
 * id with a link to Hathor Next's explorer.
 *
 * @param {Object} props
 * @param {Object|null} props.row The Hathor Next Tx row shown, or null for none
 * @param {Object} props.token { name, symbol }
 * @param {Function} props.onDismiss
 */
export const NextTxDetailsModal = ({ row, token, onDismiss }) => {
  const config = useSelector(selectSideChainConfig);
  const hathorDecimalPlaces = useSelector((state) => state.serverInfo?.decimal_places ?? 2);
  if (!row) {
    return null;
  }
  const incoming = row.direction === 'in';
  const amount = renderNextValue(BigInt(row.amount), hathorDecimalPlaces);
  const explanation = statusExplanation(row);
  const canOpenExplorer = Boolean(row.txId && config && !config.simulated);

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
          <ChainTag />
          <SimulatedTagIfMock style={styles.simulated} />
        </View>
        <Text style={styles.title}>{nextRowTitle(row)}</Text>
        <Text style={[styles.amount, incoming && styles.positive]}>
          {`${incoming ? '' : '-'}${amount} ${token?.symbol ?? ''}`}
        </Text>
        <Text style={styles.label}>{t`Status`}</Text>
        <Text style={styles.value}>{nextStatusLabel(row.status)}</Text>
        {explanation && <Text style={styles.explanation}>{explanation}</Text>}
        {row.status === 'failed' && row.reason && (
          <Text style={styles.explanation}>{`${verdictLead()} ${row.reason}`}</Text>
        )}
        <Text style={styles.label}>{t`Date`}</Text>
        <Text style={styles.value}>{moment(row.at).format('lll')}</Text>
        {row.peer && (
          <>
            <Text style={styles.label}>{t`Address`}</Text>
            <CopyClipboard text={row.peer} textStyle={styles.copyText} />
          </>
        )}
        {row.txId && (
          <>
            <Text style={styles.label}>{t`Transaction ID`}</Text>
            <CopyClipboard text={row.txId} textStyle={styles.copyText} />
          </>
        )}
        {canOpenExplorer && (
          <NewHathorButton
            secondary
            style={styles.button}
            title={t`View on explorer`}
            onPress={() => Linking.openURL(`${config.explorerUrl}transaction/${row.txId}`)}
          />
        )}
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
  amount: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
  positive: {
    color: COLORS.positiveBalanceColor,
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
  explanation: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textColorShadow,
  },
  copyText: {
    fontSize: 12,
  },
  button: {
    marginTop: 24,
  },
});
