/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  StyleSheet, Text, TouchableOpacity
} from 'react-native';
import { ViewPropTypes } from 'deprecated-react-native-prop-types';
import { COLORS } from '../styles/themes';

const NewHathorButton = (props) => {
  const wrapperViewStyle = [style.wrapper];
  const textStyle = [style.text];
  if (props.disabled) {
    wrapperViewStyle.push(style.wrapperDisabled);
    textStyle.push(style.textDisabled);
  }

  if (props.discrete) {
    wrapperViewStyle.push(style.wrapperDiscrete);
    textStyle.push(style.textDiscrete);
  }

  if (props.secondary) {
    wrapperViewStyle.push(style.wrapperSecondary);
    textStyle.push(style.textSecondary);

    if (props.disabled) {
      wrapperViewStyle.push(style.wrapperSecondaryDisabled);
      textStyle.push(style.textSecondaryDisabled);
    } else if (props.color) {
      wrapperViewStyle.push({ borderColor: props.color });
      textStyle.push({ color: props.color });
    }
  }

  if (props.danger) {
    wrapperViewStyle.push(style.wrapperSecondaryDanger);
    textStyle.push(style.textSecondaryDanger);
  }

  return (
    <TouchableOpacity
      onPress={props.onPress}
      disabled={props.disabled}
      style={[
        ...wrapperViewStyle,
        props.wrapperStyle,
        props.style
      ]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[...textStyle, props.textStyle]}
      >
        {props.title}
      </Text>
    </TouchableOpacity>
  );
};

NewHathorButton.propTypes = {
  // The title of the button.
  title: PropTypes.string,

  // Optional. Used to disable the button.
  disabled: PropTypes.bool,

  // Optional. Style used in the button container.
  wrapperStyle: ViewPropTypes.style,

  // Optional. Indicates it is a secondary action in the screen.
  secondary: PropTypes.bool,

  // Optional. The color of the button.
  // It is only supported for secondary buttons and changes both the border and the text color.
  color: PropTypes.string,
};

const style = StyleSheet.create({
  wrapper: {
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.textColor,
    alignSelf: 'stretch',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wrapperDisabled: {
    backgroundColor: COLORS.textColorShadowOpacity005,
  },
  wrapperSecondary: {
    backgroundColor: COLORS.backgroundColor,
    borderColor: COLORS.textColor,
    borderWidth: 1.5,
  },
  wrapperSecondaryDisabled: {
    borderColor: COLORS.textColorShadow,
  },
  wrapperDiscrete: {
    backgroundColor: COLORS.backgroundColor,
    borderColor: COLORS.backgroundColor,
    borderWidth: 1.5,
  },
  wrapperSecondaryDanger: {
    borderColor: COLORS.errorBgColor,
  },
  text: {
    fontWeight: 'bold',
    fontSize: 14,
    textTransform: 'uppercase',
    color: COLORS.backgroundColor,
    textAlign: 'center',
  },
  textSecondary: {
    color: COLORS.textColor,
  },
  textSecondaryDisabled: {
    color: COLORS.textColorShadow,
  },
  textDisabled: {
    color: COLORS.textColorShadow,
  },
  textDiscrete: {
    color: COLORS.freeze300,
  },
  textSecondaryDanger: {
    color: COLORS.errorBgColor,
  },
});

export default NewHathorButton;
