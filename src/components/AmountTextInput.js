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

// Auto-shrink lower bound: never scale the font below this fraction of
// the base size, so very long amounts stay readable even when scaled.
const MIN_FONT_SCALE = 0.5;

// Average glyph width as a fraction of fontSize for the bold sans-serif
// AmountTextInput uses. We don't measure rendered text (an earlier
// implementation that did caused a Folly F14Set assertion crash on
// iOS 26.1 + Fabric due to the extra hidden <Text> re-rendering on
// every keystroke), so we estimate width as
// `length * fontSize * GLYPH_RATIO`. Slightly conservative for digits
// and slightly generous for `,` / `.` — net effect is the font shrinks
// a hair sooner than strictly necessary, which is preferable to letting
// the value clip behind the token selector.
const GLYPH_RATIO = 0.55;

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

  // Auto-shrink-to-fit: amounts can grow long enough to overflow the
  // input's column (e.g. `957,791,973.79`). We capture the column
  // width once via the TextInput's `onLayout` and scale `fontSize` down
  // when the estimated text width (length × fontSize × GLYPH_RATIO)
  // exceeds it. When the user shortens the value, the estimate drops
  // and the font scales back up to the base size.
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

  // Resolve the base (unscaled) font size from the merged style chain
  // so callers that override fontSize via `customStyle` still get
  // correct scaling math.
  const flatStyle = StyleSheet.flatten([style.input, customStyle]) || {};
  const baseFontSize = flatStyle.fontSize ?? 32;
  const minFontSize = Math.max(14, Math.floor(baseFontSize * MIN_FONT_SCALE));
  const displayed = text || placeholder;
  const estimatedWidth = displayed.length * baseFontSize * GLYPH_RATIO;
  const scaledFontSize = (containerWidth > 0 && estimatedWidth > containerWidth)
    ? Math.max(
      minFontSize,
      Math.floor(baseFontSize * (containerWidth / estimatedWidth)),
    )
    : baseFontSize;

  return (
    <TextInput
      ref={inputRef}
      style={[style.input, customStyle, { fontSize: scaledFontSize }]}
      onChangeText={onChangeText}
      value={text}
      textAlign={textAlign || 'center'}
      textAlignVertical='bottom'
      keyboardAppearance='dark'
      keyboardType='numeric'
      placeholder={placeholder}
      placeholderTextColor={COLORS.midContrastDetail}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
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
