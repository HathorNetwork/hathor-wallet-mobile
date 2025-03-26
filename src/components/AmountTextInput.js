/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { getAmountParsed, getIntegerAmount } from '../utils';
import { COLORS } from '../styles/themes';

class AmountTextInput extends React.Component {
  constructor(props) {
    super(props);

    this.inputRef = React.createRef();

    // Store the text value
    this.state = {
      text: props.value || '',
    };
  }

  componentDidUpdate(prevProps) {
    // Update internal state if value prop changes externally
    if (prevProps.value !== this.props.value && this.props.value !== this.state.text) {
      this.setState({
        text: this.props.value || '',
      });
    }
  }

  focus = () => {
    /* After the focus method is called, the screen is still re-rendered at least once more.
     * Requesting a delay before the focus command ensures it is executed on the final rendering
     * of the component.
     */
    setTimeout(() => {
      this.inputRef.current.focus();
    }, 50);
  }

  onChangeText = (text) => {
    if (text === '') {
      // Need to handle empty string separately
      this.setState({ text: '' });
      this.props.onAmountUpdate(text, null);
      return;
    }

    let parsedText = text;
    let bigIntValue;
    if (this.props.allowOnlyInteger) {
      // We allow only integers for NFT
      parsedText = parsedText.replace(/[^0-9]/g, '');
    }

    parsedText = getAmountParsed(parsedText);

    // There is no NaN in BigInt, it either returns a valid bigint or throws
    // an error.
    let isValid = true;
    try {
      bigIntValue = getIntegerAmount(parsedText);

      if (bigIntValue < 0n) {
        isValid = false;
      }
    } catch (e) {
      isValid = false;
    }

    if (isValid) {
      this.setState({ text: parsedText });
      // Pass both text and BigInt value to parent
      this.props.onAmountUpdate(parsedText, bigIntValue);
    }
  }

  render() {
    const placeholder = this.props.allowOnlyInteger ? '0' : '0.00';
    const { style: customStyle, ...props } = this.props;

    return (
      <TextInput
        ref={this.inputRef}
        style={[style.input, customStyle]}
        onChangeText={this.onChangeText}
        value={this.state.text}
        textAlign='center'
        textAlignVertical='bottom'
        keyboardAppearance='dark'
        keyboardType='numeric'
        placeholder={placeholder}
        placeholderTextColor={COLORS.midContrastDetail}
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
    color: COLORS.textColor,
  },
});

export default AmountTextInput;
