/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { t } from 'ttag';
import { COLORS } from '../../../styles/themes';
import CopyClipboard from '../../CopyClipboard';

/**
 * Component for displaying signed data with value and signature
 */
export const SignedDataDisplay = ({ value }) => {
  const getSignatureText = () => {
    if (Array.isArray(value.signature)) {
      return value.signature.join('');
    }
    return value.signature;
  };

  const getValueText = () => {
    if (Array.isArray(value.value)) {
      return value.value.join(', ');
    }
    return value.value;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.valueLabel}>{t`Value`}</Text>
      <Text style={styles.valueText}>{getValueText()}</Text>

      <Text style={styles.signatureLabel}>{t`Signature`}</Text>
      <View style={styles.signatureContainer}>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureText} selectable>
            {getSignatureText()}
          </Text>
        </View>
        <CopyClipboard
          data={getSignatureText()}
          style={styles.copyButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'hsla(0, 0%, 96%, 1)',
    borderRadius: 4,
    padding: 8,
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  valueText: {
    fontSize: 12,
    color: COLORS.black,
    marginBottom: 12,
  },
  signatureLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  signatureContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  signatureBox: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 8,
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'hsla(0, 0%, 90%, 1)',
  },
  signatureText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: COLORS.black,
    lineHeight: 16,
  },
  copyButton: {
    padding: 4,
  },
});

