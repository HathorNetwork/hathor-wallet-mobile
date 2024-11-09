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
 * @property {Object} children - The children component to be rendered.
 *
 * @param {Props} props - The props for the SimpleButton component.
 */
const SimpleButton = ({
  title,
  textStyle = {},
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
      return (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={textStyles}
        >
          {title}
        </Text>
      );
    }
    return null;
  };
  const renderIcon = () => {
    if (icon) {
      return (
        <View style={[styles.icon, title ? styles.iconWithTitle : null, iconStyle]}>
          <Image
            source={icon}
            resizeMode='contain'
            style={styles.iconImage}
          />
        </View>
      );
    }
    return null;
  };
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.container, containerStyle]}
    >
      <View style={styles.contentContainer}>
        {renderTitle()}
        {renderIcon()}
        {children}
      </View>
    </TouchableOpacity>
  );
};
const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    lineHeight: 24,
    color: PRIMARY_COLOR,
    textAlign: 'center',
  },
  icon: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },
  iconWithTitle: {
    marginLeft: 8,
  },
  iconImage: {
    width: '100%',
    height: '100%',
  },
});
export default SimpleButton;
