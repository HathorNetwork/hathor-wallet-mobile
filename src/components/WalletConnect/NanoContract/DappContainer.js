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
  Image
} from 'react-native';
import { t } from 'ttag';
import { commonStyles } from '../theme';

/**
 * Renders DApp information.
 *
 * @param {Object} props
 * @param {Object} props.dapp
 */
export const DappContainer = ({ dapp }) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <View style={styles.avatar}>
        <Image
          source={{ uri: dapp.icon }}
          width={48}
          height={48}
          style={styles.avatarIcon}
        />
      </View>
      <View>
        <Text style={styles.proposer}>{dapp.proposer}</Text>
        <Text style={styles.network}>{'• '}{'mainnet'}</Text>
      </View>
    </View>
    <View>
      <Text style={styles.emphasis}>{t`Review your transaction from this dApp`}</Text>
    </View>
    <View>
      <Text style={commonStyles.text}>{t`Stay vigilant and protect your data from potential phishing attempts.`}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    gap: 16,
  },
  avatar: {
    flexShrink: 1,
    alignSelf: 'flex-start',
    maxWidth: 48,
    maxHeight: 48,
  },
  avatarIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'hsla(0, 0%, 85%, 1)',
    borderRadius: 24,
  },
  proposer: [
    commonStyles.text,
    commonStyles.bold,
    commonStyles.mb4,
  ],
  network: [
    commonStyles.text,
    { color: 'hsla(263, 100%, 64%, 1)', }
  ],
  emphasis: [
    commonStyles.text,
    commonStyles.bold
  ]
});
