/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { isSideChainSimulated } from '../../multichain/gating';
import { COLORS } from '../../styles/themes';

/**
 * Marks Hathor Next data that is simulated, so nobody mistakes it for real money.
 *
 * @param {Object} props
 * @param {Object} [props.style]
 */
export const SimulatedTag = ({ style }) => (
  <View style={[styles.tag, style]}>
    <Text style={styles.text}>{t`Simulated`}</Text>
  </View>
);

/**
 * The Simulated tag, only while the Hathor Next client is the simulated one.
 *
 * @param {Object} props
 * @param {Object} [props.style]
 */
export const SimulatedTagIfMock = ({ style }) => {
  const simulated = useSelector(isSideChainSimulated);
  return simulated ? <SimulatedTag style={style} /> : null;
};

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.textColorShadow,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    color: COLORS.textColorShadow,
    textTransform: 'uppercase',
  },
});
