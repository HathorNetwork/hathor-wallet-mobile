/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { getAmountParsed, getIntegerAmount, computeAmountFontFit, AMOUNT_MAX_LINES } from '../utils';
import { MAX_DECIMAL_PLACES } from '../constants';
import { COLORS } from '../styles/themes';

// Rendered line height as a fraction of the font size, reserving room for the
// wrapped lines without clipping the bold glyphs.
const LINE_HEIGHT_RATIO = 1.2;

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
 * @param {number} [props.decimalPlaces] - Number of decimal places for the token's value scale
 * @param {number} [props.fontSize] - Explicit display font size in px (parent-controlled mode)
 * @param {boolean} [props.singleLine] - Pin the input to a fixed one-line height (no wrapping)
 * @param {React.Ref} ref - Forwarded ref, exposes the focus() method
 * @returns {React.ReactElement} A formatted amount input component
 */
const AmountTextInput = forwardRef((props, ref) => {
  const inputRef = useRef(null);
  const [text, setText] = useState(props.value || '');
  const { decimalPlaces } = props;

  // Self-measure: the input's own column width, captured via onLayout, drives the
  // font ladder. Unused when the parent passes an explicit fontSize.
  const [containerWidth, setContainerWidth] = useState(0);

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

    // The numeric keyboard shouldn't emit newlines, but a multiline input can
    // receive them via paste; strip so they never reach the parser.
    let parsedText = newText.replace(/[\n\r]/g, '');
    let bigIntValue;
    if (props.allowOnlyInteger) {
      // We allow only integers for NFT
      parsedText = parsedText.replace(/[^0-9]/g, '');
    }

    // Accept up to MAX_DECIMAL_PLACES typed decimals regardless of the token's
    // precision; the value below is still scaled to the token's decimalPlaces.
    parsedText = getAmountParsed(parsedText, MAX_DECIMAL_PLACES);

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

  const { style: customStyle, textAlign, fontSize, singleLine, ...restProps } = props;

  const isControlledSize = fontSize != null;
  const displayed = text || placeholder;
  const resolvedFontSize = isControlledSize
    ? fontSize
    : computeAmountFontFit(displayed.length, containerWidth).fontSize;
  const lineHeight = Math.round(resolvedFontSize * LINE_HEIGHT_RATIO);
  const heightStyle = singleLine
    ? { height: lineHeight }
    : { maxHeight: lineHeight * AMOUNT_MAX_LINES };

  return (
    <TextInput
      ref={inputRef}
      style={[
        style.input,
        customStyle,
        { fontSize: resolvedFontSize, lineHeight },
        heightStyle,
      ]}
      onChangeText={onChangeText}
      value={text}
      multiline
      scrollEnabled={false}
      textAlign={textAlign || 'center'}
      textAlignVertical='center'
      keyboardAppearance='dark'
      keyboardType='numeric'
      placeholder={placeholder}
      placeholderTextColor={COLORS.midContrastDetail}
      onLayout={isControlledSize
        ? undefined
        : (e) => setContainerWidth(e.nativeEvent.layout.width)}
      {...restProps}
    />
  );
});

const style = StyleSheet.create({
  input: {
    fontWeight: 'bold',
    paddingVertical: 0,
    color: COLORS.textColor,
  },
});

export default AmountTextInput;
