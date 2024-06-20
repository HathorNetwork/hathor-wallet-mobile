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
  TouchableOpacity,
} from 'react-native';
import { t } from 'ttag';
import { COLORS } from '../../../styles/themes';
import { NanoContractIcon } from '../../Icons/NanoContract.icon';
import { PenIcon } from '../../Icons/Pen.icon';
import { commonStyles } from '../theme';

/**
 * It renders a card with basic information to execute the Nano Contract creation.
 *
 * @param {Object} props
 * @param {Object} props.nc Nano Contract info.
 * @param {string} props.blueprintName Nano Contract's blueprint name.
 * @param {() => void} props.onSelectAddress Callback fn for tap on caller address component.
 */
export const NanoContractExecInfo = ({ nc, blueprintName, onSelectAddress }) => (
  <View style={[commonStyles.card, commonStyles.cardSplit]}>
    <View style={commonStyles.cardSplitIcon}>
      <NanoContractIcon type='fill' color={COLORS.white} />
    </View>
    <View style={commonStyles.cardSplitContent}>
      <View>
        <Text style={styles.property}>{t`Nano Contract ID`}</Text>
        <Text style={styles.value}>{nc.ncId}</Text>
      </View>
      <View>
        <Text style={styles.property}>{t`BluePrint ID`}</Text>
        <Text style={styles.value}>{nc.blueprintId}</Text>
      </View>
      <View>
        <Text style={styles.property}>{t`Blueprint Name`}</Text>
        <Text style={styles.value}>{blueprintName}</Text>
      </View>
      <View style={commonStyles.cardSeparator} />
      <TouchableOpacity onPress={onSelectAddress}>
        <View style={styles.contentEditable}>
          <View style={styles.contentEditableValue}>
            <Text style={styles.property}>Caller</Text>
            <Text style={styles.value}>{nc.caller}</Text>
          </View>
          <View style={styles.contentEditableIcon}>
            <PenIcon />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  property: [commonStyles.text, commonStyles.bold, commonStyles.mb4],
  value: [commonStyles.text, commonStyles.value],
  contentEditable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contentEditableValue: {
    flexShrink: 1,
    paddingRight: 8,
  },
  contentEditableIcon: {
    width: 24,
    paddingRight: 2,
  },
});
