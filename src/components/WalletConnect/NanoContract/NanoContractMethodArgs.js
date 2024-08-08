/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { get } from 'lodash';
import { COLORS } from '../../../styles/themes';
import { commonStyles } from '../theme';

/**
 * It renders a list of method arguments for when the Nano Contract executes.
 *
 * @param {Object} props
 * @param {string} props.blueprintId ID of blueprint.
 * @param {string} props.method Method's name.
 * @param {string[]} props.ncArgs A list of method's argument.
 */
export const NanoContractMethodArgs = ({ blueprintId, method, ncArgs }) => {
  if (!ncArgs.length) {
    return null;
  }

  const blueprintInfo = useSelector((state) => state.nanoContract.blueprint[blueprintId]);
  const argEntries = useMemo(() => {
    const _methodInfo = get(blueprintInfo?.data, `public_methods.${method}`, null);
    if (_methodInfo) {
      return ncArgs.map((arg, idx) => [_methodInfo.args[idx].name, arg]);
    }

    return ncArgs.map((arg, idx) => [t`Position ${idx}`, arg]);
  }, [blueprintInfo]);

  return (
    <View>
      <View>
        <Text style={commonStyles.sectionTitle}>{t`Argument List`}</Text>
      </View>
      {argEntries.length
        && (
          <View style={[commonStyles.card]}>
            <View style={[commonStyles.cardStack]}>
              {argEntries.map(([argName, argValue]) => (
                <View
                  key={argName}
                  style={commonStyles.cardStackItem}
                >
                  <View style={styles.argPosition}>
                    <Text style={styles.argPositionText}>{argName}</Text>
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
  )
};

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
