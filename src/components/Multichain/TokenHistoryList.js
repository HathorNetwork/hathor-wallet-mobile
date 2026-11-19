/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from 'ttag';
import Spinner from '../Spinner';
import { HathorFlatList } from '../HathorFlatList';
import { HathorList } from '../HathorList';
import { Strong } from '../../utils';
import { COLORS } from '../../styles/themes';

/**
 * A token's history of rows of either chain (src/multichain/history.js), with the states the
 * token screen has: loading, failed with Try again, and empty.
 *
 * @param {Object} props
 * @param {Object[]} props.rows
 * @param {boolean} props.loading
 * @param {boolean} props.failed
 * @param {Function} props.onRetry
 * @param {Function} props.renderRow Called with a row
 * @param {Function} props.onEndReached
 */
export const TokenHistoryList = ({
  rows,
  loading,
  failed,
  onRetry,
  renderRow,
  onEndReached,
}) => {
  if (loading) {
    return (
      <HathorList infinity>
        <View style={styles.centered}>
          <Strong>{t`Loading transactions`}</Strong>
          <Spinner size={48} animating style={styles.spinner} />
        </View>
      </HathorList>
    );
  }
  if (failed) {
    return (
      <HathorList infinity>
        <View style={styles.centered}>
          <Strong style={styles.errorTitle}>
            {t`There was an error loading your transaction history`}
          </Strong>
          <Text style={styles.retry} onPress={onRetry}>{t`Try again`}</Text>
        </View>
      </HathorList>
    );
  }
  if (!rows.length) {
    return (
      <HathorList infinity>
        <View style={styles.centered}>
          <Strong>{t`No transactions`}</Strong>
        </View>
      </HathorList>
    );
  }
  return (
    <HathorFlatList
      data={rows}
      renderItem={({ item }) => renderRow(item)}
      keyExtractor={(item) => item.key}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.2}
    />
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  spinner: {
    marginTop: 32,
  },
  errorTitle: {
    textAlign: 'center',
  },
  retry: {
    marginTop: 8,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
});
