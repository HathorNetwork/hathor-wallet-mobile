/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import InputLabel from './InputLabel';
import { COLORS } from '../styles/themes';

const SimpleInput = (props) => {
  const getInputField = () => (
    <TextInput
      {...props}
      style={styles.input}
      keyboardAppearance='dark'
      autoCorrect={false}
      spellCheck={false}
      autoCompleteType='off'
      underlineColorAndroid='transparent'
    />
  );

  const renderInput = () => (
    <View style={[styles.inputContainer, props.textInputStyle]}>
      { props.input || getInputField() }
    </View>
  );

  const renderText = () => <Text selectable style={styles.text}>{props.value}</Text>;

  const renderAuxiliarText = () => {
    let text = null;
    const style = [styles.auxiliarText];
    if (props.error) {
      text = props.error;
      style.push(styles.error);
    } else if (props.subtitle) {
      text = props.subtitle;
    }

    if (text) {
      return <Text style={style}>{text}</Text>;
    }
    return null;
  };

  return (
    <View style={props.containerStyle}>
      {props.label
        && (
        <InputLabel style={[styles.label, props.inputStyle]}>
          {props.label}
        </InputLabel>
        )}
      {/* If input is not editable, render only Text so we can select
        * it. If we used TextInput with editable=false, we would not
        * be able to select the text
        */}
      {props.editable === false ? renderText() : renderInput()}
      {renderAuxiliarText()}
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    borderBottomWidth: 1,
    borderColor: COLORS.borderColor,
    paddingBottom: 8,
  },
  input: {
    lineHeight: 16,
    padding: 0,
    fontSize: 14,
  },
  text: {
    color: COLORS.textColor,
    fontSize: 14,
  },
  label: {
    marginBottom: 12,
  },
  auxiliarText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textColorShadow,
  },
  error: {
    // TODO Maybe also change underline color to red?
    color: COLORS.errorTextColor,
  },
});

export default SimpleInput;
