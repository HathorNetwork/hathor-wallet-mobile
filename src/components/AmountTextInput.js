/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { getAmountParsed, getIntegerAmount } from '../utils';

class AmountTextInput extends React.Component {
  constructor(props) {
    super(props);

    this.inputRef = React.createRef();
  }

  focus = () => {
    this.inputRef.current.focus();
  }

  onChangeText = (text) => {
    if (text === '') {
      // Need to handle empty string separately
      this.props.onAmountUpdate(text);
      return;
    }

    if (this.props.allowOnlyInteger) {
      // We allow only integers for NFT
      text = text.replace(/[^0-9]/g, '');
    }

    const parsedText = getAmountParsed(text);

    if (!this.props.allowOnlyInteger) {
      const amount = getIntegerAmount(parsedText);
      if (Number.isNaN(amount) || amount < 0) {
        return;
      }
    }

    this.props.onAmountUpdate(parsedText);
  }

  render() {
    const placeholder = this.props.allowOnlyInteger ? '0' : '0.00';
    const { style: customStyle, ...props } = this.props;
    return (
      <TextInput
        ref={this.inputRef}
        style={[style.input, customStyle]}
        onChangeText={this.onChangeText}
        textAlign='center'
        textAlignVertical='bottom'
        keyboardAppearance='dark'
        keyboardType='numeric'
        placeholder={placeholder}
        {...props}
      />
    );
  }
}

const style = StyleSheet.create({
  input: {
    height: 38,
    lineHeight: 38,
    fontSize: 32,
    fontWeight: 'bold',
    paddingVertical: 0,
    color: 'black',
  },
});

export default AmountTextInput;
