/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  StyleSheet, Text, TouchableOpacity, View, ViewPropTypes,
} from 'react-native';

const NewHathorButton = (props) => {
  const wrapperViewStyle = [style.wrapper];
  const textStyle = [style.text];
  if (props.disabled) {
    wrapperViewStyle.push(style.wrapperDisabled);
    textStyle.push(style.textDisabled);
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

  return (
    <View style={[...wrapperViewStyle, props.wrapperStyle, props.style]}>
      <TouchableOpacity onPress={props.onPress} style={style.touchable} disabled={props.disabled}>
        <Text style={[...textStyle, props.textStyle]}>{props.title}</Text>
      </TouchableOpacity>
    </View>
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
    backgroundColor: '#000',
    alignSelf: 'stretch',
  },
  wrapperDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  wrapperSecondary: {
    backgroundColor: '#fff',
    borderColor: '#000',
    borderWidth: 1.5,
  },
  wrapperSecondaryDisabled: {
    borderColor: 'rgba(0, 0, 0, 0.5)',
  },
  touchable: {
    padding: 16,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: 'bold',
    fontSize: 14,
    textTransform: 'uppercase',
    color: '#fff',
    textAlign: 'center',
  },
  textSecondary: {
    color: '#000',
  },
  textSecondaryDisabled: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  textDisabled: {
    color: 'rgba(0,0,0,0.5)',
  },
});

export default NewHathorButton;
