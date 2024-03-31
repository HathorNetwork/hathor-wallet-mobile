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

/**
 * Simple button component.
 *
 * @typedef {Object} Props
 * @property {string} [title] - The title text of the button.
 * @property {Object} [textStyle] - The style object for the text of the button.
 * @property {string} [color] - The color of button's text.
 * @property {string} [icon] - The icon component to be displayed in the button.
 * @property {Object} [iconStyle] - The style object for the icon component.
 * @property {Object} [containerStyle] - The style object for the container of the button.
 * @property {Function} onPress - The function to be called when the button is pressed.
 *
 * @param {Props} props - The props for the SimpleButton component.
 */
const SimpleButton = ({
  title,
  textStyle,
  color,
  icon,
  iconStyle,
  containerStyle,
  onPress,
  children
}) => {
  const renderTitle = () => {
    if (title) {
      const textStyles = [styles.text, textStyle];
      if (color) {
        textStyles.push({ color });
      }
      return <Text style={textStyles}>{title}</Text>;
    }

    return null;
  };

  const renderIcon = () => {
    if (icon) {
      return (
        <View style={[styles.icon, iconStyle]}>
          <Image source={icon} />
        </View>
      );
    }

    return null;
  };

  return (
    <TouchableOpacity onPress={onPress} style={[styles.container, containerStyle]}>
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
