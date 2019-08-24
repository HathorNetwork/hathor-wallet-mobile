/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet, Text, View,
} from 'react-native';

const InfoBox = (props) => {
  const renderIcon = () => {
    if (props.icon) {
      return (
        <View style={[styles.icon, props.iconStyle]}>
          <Image source={props.icon} />
        </View>
      );
    }

    return null;
  };

  const items = props.items.map((item, index) => {
    return React.cloneElement(item, {style: [styles.text, item.style], key: index});
  });

  return (
    <View style={[styles.wrapper, styles.text]}>
      {items}
    </View>
  );
};

//TODO add proptypes

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    lineHeight: 24,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  wrapper: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#f7f7f7',
    borderRadius: 8,
  },
});

export default InfoBox;
