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
import { commonStyles } from '../theme';

/**
 * It renders a list of method arguments for when the Nano Contract executes.
 *
 * @param {Object} props
 * @param {string[]} props.ncArgs A list of method's argument.
 */
export const NanoContractMethodArgs = ({ ncArgs }) => (
  <View>
    <View>
      <Text style={commonStyles.sectionTitle}>{t`Argument List`}</Text>
    </View>
    {ncArgs.length
      && (
        <View style={[commonStyles.card]}>
          <View style={[commonStyles.cardStack]}>
            {ncArgs.map((argValue, index) => (
              <View key={`${argValue}:${Date.now().toString()}`} style={commonStyles.cardStackItem}>
                <View style={styles.argPosition}>
                  <Text style={styles.argPositionText}>{t`Position ${index}`}</Text>
                </View>
                <View style={styles.argValue}>
                  <Text style={styles.argValueText}>{argValue}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
  </View>
);

const styles = StyleSheet.create({
  argPosition: {
    flexShrink: 10,
    width: '30%',
    paddingRight: 8,
  },
  argPositionText: [
    commonStyles.text,
    commonStyles.bold
  ],
  argValue: {
    maxWidth: '70%',
    backgroundColor: 'hsla(0, 0%, 96%, 1)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  argValueText: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.black,
  },
});
