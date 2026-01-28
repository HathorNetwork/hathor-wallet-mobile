/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { getAmountParsed, getIntegerAmount } from '../utils';
import { COLORS } from '../styles/themes';

/**
 * Text input component specifically for handling token amounts with BigInt validation.
 *
 * @param {Object} props
 * @param {string} [props.value] - Initial input value
 * @param {Function} props.onAmountUpdate - Callback when amount changes:
 *                                          (text, bigIntValue) => void where text is the
 *                                          formatted string and bigIntValue is the parsed BigInt
 * @param {boolean} [props.allowOnlyInteger=false] - If true, only allow integer values
 *                                                   (no decimals)
 * @param {Object} [props.style] - Additional styles for the TextInput
 * @param {boolean} [props.autoFocus] - Whether the input should be focused on mount
 * @param {number} [props.decimalPlaces] - Number of decimal places to use
 * @param {React.Ref} ref - Forwarded ref, exposes the focus() method
 * @returns {React.ReactElement} A formatted amount input component
 */
const AmountTextInput = forwardRef((props, ref) => {
  const inputRef = useRef(null);
  const [text, setText] = useState(props.value || '');
  const { decimalPlaces } = props;

  // Expose the focus method to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      // Add a safety check to prevent null reference errors
      if (inputRef.current) {
        /* After the focus method is called, the screen is still re-rendered at least once more.
         * Requesting a delay before the focus command ensures it is executed on the final rendering
         * of the component.
         */
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 50);
      }
    }
  }));

  useEffect(() => {
    // Update internal state if value prop changes externally
    // Only update the display text, don't re-parse or call onAmountUpdate
    // The parent component is responsible for keeping the BigInt state correct
    if (props.value !== text) {
      setText(props.value || '');
    }
  }, [props.value]);

  const onChangeText = (newText) => {
    if (newText === '' || newText == null) {
      // Need to handle empty string separately
      setText('');
      props.onAmountUpdate(newText, null);
      return;
    }

    let parsedText = newText;
    let bigIntValue;
    if (props.allowOnlyInteger) {
      // We allow only integers for NFT
      parsedText = parsedText.replace(/[^0-9]/g, '');
    }

    parsedText = getAmountParsed(parsedText, decimalPlaces);

    // There is no NaN in BigInt, it either returns a valid bigint or throws
    // an error.
    let isValid = true;
    try {
      bigIntValue = getIntegerAmount(parsedText, decimalPlaces);

      if (bigIntValue < 0n) {
        isValid = false;
      }
    } catch (e) {
      isValid = false;
    }

    if (isValid) {
      setText(parsedText);
      // Pass both text and BigInt value to parent
      props.onAmountUpdate(parsedText, bigIntValue);
    }
  };

  let placeholder;
  if (props.allowOnlyInteger) {
    placeholder = '0';
  } else {
    const zeros = '0'.repeat(decimalPlaces);
    placeholder = `0.${zeros}`;
  }

  const { style: customStyle, textAlign, ...restProps } = props;

  return (
    <TextInput
      ref={inputRef}
      style={[style.input, customStyle]}
      onChangeText={onChangeText}
      value={text}
      textAlign={textAlign || 'center'}
      textAlignVertical='bottom'
      keyboardAppearance='dark'
      keyboardType='numeric'
      placeholder={placeholder}
      placeholderTextColor={COLORS.midContrastDetail}
      {...restProps}
    />
  );
});

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
