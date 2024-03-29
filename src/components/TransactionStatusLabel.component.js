/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View, } from 'react-native';
import { t } from 'ttag';
import { COLORS } from '../styles/themes';
import { CircleCheck } from './CircleCheck.icon';
import { CircleClock } from './CircleClock.icon';
import { CircleError } from './CircleError.icon';

const styles = StyleSheet.create({
  wrapper: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderRadius: 100,
    paddingVertical: 4,
    paddingLeft: 12,
    // Adds optical effect of centralization for the whole object
    paddingRight: 14,
  },
  label: {
    fontSize: 12,
    lineHeight: 20,
  },
  feedbackSuccess: {
    backgroundColor: COLORS.feedbackSuccess100,
    color: COLORS.feedbackSuccess400,
  },
  feedbackWarning: {
    backgroundColor: COLORS.feedbackWarning100,
    color: COLORS.feedbackWarning300,
  },
  feedbackError: {
    backgroundColor: COLORS.feedbackError200,
    color: COLORS.feedbackError600,
  },
  freeze: {
    backgroundColor: COLORS.freeze100,
    color: COLORS.freeze300,
  },
});

/**
 * @param {Object} param
 * @param {string} param.label Status text as label
 * @param {Object} param.style Style props to customize the base component
 * @param {Object} param.children Icon component to compose with the label
 */
const TransactionStatusBase = ({ label, style, children: icon }) => {
  return (
    <View style={[styles.wrapper, style]}>
      <View>
        {icon}
      </View>
      <View>
        <Text style={[styles.label, style]}>
          {label.toUpperCase()}
        </Text>
      </View>
    </View>
  );
};

const Confirmed = () => (
  <TransactionStatusBase style={styles.feedbackSuccess} label={t`Confirmed`}>
    <CircleCheck size={16} color={styles.feedbackSuccess.color} />
  </TransactionStatusBase>
);
const Processing = () => (
  <TransactionStatusBase style={styles.feedbackWarning} label={t`Processing`} >
    <CircleClock size={16} color={styles.feedbackWarning.color} />
  </TransactionStatusBase>
);
const Voided = () => (
  <TransactionStatusBase style={styles.feedbackError} label={t`Voided`} >
    <CircleError size={16} color={styles.feedbackError.color} />
  </TransactionStatusBase>
);
const Unkown = () => (
  <TransactionStatusBase style={styles.freeze} label={t`Unkown`} >
    <CircleError size={16} color={styles.freeze.color} />
  </TransactionStatusBase>
);

/**
 * @param {Object} param
 * @param {'confirmed'|'processing'} param.processingStatus Status of a Nano Contract transaction
 * @param {boolean} param.isVoided Transaction's void flag
 */
export const TransactionStatusLabel = ({ processingStatus, isVoided = false }) => {
  const status = isVoided ? 'voided' : processingStatus;

  if (status === 'confirmed') {
    return Confirmed();
  } else if (status === 'processing') {
    return Processing();
  } else if (status === 'voided') {
    return Voided();
  } else {
    // In case status is undefined
    return Unkown();
  }
};
