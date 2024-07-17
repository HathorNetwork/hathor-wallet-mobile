/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  FlatList, StyleSheet, View,
} from 'react-native';
import { COLORS } from '../styles/themes';

/**
 * param {FlatListProps} props
 */
export const HathorFlatList = (props) => (
  <View style={[styles.wrapper, props.wrapperStyle]}>
    <FlatList
      ItemSeparatorComponent={ItemSeparator}
      // Introduced last to allow overwrite
      {...props}
    />
  </View>
);

const ItemSeparator = () => (
  <View style={styles.itemSeparator} />
);

const styles = StyleSheet.create({
  wrapper: {
    flexShrink: 1,
    alignSelf: 'stretch',
    marginTop: 16,
    marginBottom: 24,
    backgroundColor: COLORS.backgroundColor,
    marginHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 4,
    shadowColor: COLORS.textColor,
    shadowOpacity: 0.08,
    paddingTop: 16,
    paddingBottom: 16,
  },
  itemSeparator: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.borderColor
  },
});
