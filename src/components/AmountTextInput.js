/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { bigIntCoercibleSchema } from '@hathor/wallet-lib/lib/utils/bigint';
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

  // Parse text to BigInt
  parseAmount = (text) => {
    if (!text) return null;

    try {
      if (this.props.allowOnlyInteger) {
        // For NFTs, directly parse as integer then to BigInt
        return bigIntCoercibleSchema.parse(parseInt(text, 10));
      }
      // For regular tokens, use getIntegerAmount which returns BigInt
      return getIntegerAmount(text);
    } catch (e) {
      console.error('Failed to parse amount to BigInt:', e);
      return null;
    }
  }

  onChangeText = (text) => {
    if (text === '') {
      // Need to handle empty string separately
      this.setState({ text: '' });
      this.props.onAmountUpdate('', null);
      return;
    }

    let parsedText = text;
    if (this.props.allowOnlyInteger) {
      // We allow only integers for NFT
      parsedText = parsedText.replace(/[^0-9]/g, '');
    }

    parsedText = getAmountParsed(parsedText);

    let bigIntValue = null;
    let isValid = true;

    if (!this.props.allowOnlyInteger) {
      try {
        // Parse to BigInt and validate
        bigIntValue = getIntegerAmount(parsedText);
        // Convert to Number only for validation
        const amountNumber = Number(bigIntValue);
        if (Number.isNaN(amountNumber) || amountNumber < 0) {
          isValid = false;
        }
      } catch (e) {
        console.error('Failed to validate amount:', e);
        isValid = false;
      }
    } else {
      try {
        // For integers (NFTs), directly parse to BigInt
        bigIntValue = bigIntCoercibleSchema.parse(parseInt(parsedText, 10) || 0);
      } catch (e) {
        console.error('Failed to parse integer amount to BigInt:', e);
        isValid = false;
      }
    }

    if (isValid) {
      this.setState({ text: parsedText });
      // Pass both the text representation and BigInt value to parent
      this.props.onAmountUpdate(parsedText, bigIntValue);
    }
  }

  render() {
    const placeholder = this.props.allowOnlyInteger ? '0' : '0.00';
    const { style: customStyle, ...props } = this.props;

    // Filter out value as we're managing it internally
    const { value, onAmountUpdate, allowOnlyInteger, ...otherProps } = props;

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
        {...otherProps}
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
