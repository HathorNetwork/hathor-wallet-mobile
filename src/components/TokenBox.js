/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet, TouchableWithoutFeedback, View, Text,
} from 'react-native';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faSortDown } from '@fortawesome/free-solid-svg-icons';
import { COLORS } from '../styles/themes';

const TokenBox = (props) => (
  <TouchableWithoutFeedback onPress={props.onPress}>
    <View style={styles.wrapper}>
      <Text style={styles.label}>{props.label}</Text>
      <FontAwesomeIcon icon={faSortDown} color='rgba(0, 0, 0, 0.7)' style={{ marginBottom: 5 }} />
    </View>
  </TouchableWithoutFeedback>
);

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    height: 40,
    width: 80,
    borderWidth: 1,
    borderColor: COLORS.textColor,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 19,
  },
});

export default TokenBox;
