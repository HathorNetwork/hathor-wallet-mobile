/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { PRIMARY_COLOR } from '../constants';

const SimpleButton = (props) => {
  const { children } = props;
  const renderTitle = () => {
    if (props.title) {
      const textStyles = [styles.text, props.textStyle];
      if (props.color) {
        textStyles.push({ color: props.color });
      }
      return <Text style={textStyles}>{props.title}</Text>;
    }

    return null;
  };

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

  return (
    <TouchableOpacity onPress={props.onPress} style={[styles.container, props.containerStyle]}>
      {renderTitle()}
      {renderIcon()}
      {children}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    lineHeight: 24,
    color: PRIMARY_COLOR,
  },
  icon: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },
});

export default SimpleButton;
