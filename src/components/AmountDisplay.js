/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { Text } from 'react-native';
import {
  computeAmountFontFit,
  AMOUNT_FONT_BASE_SIZE,
  AMOUNT_FONT_MIN_SIZE,
  AMOUNT_MAX_LINES,
} from '../utils';

// Line height as a fraction of font size; matches AmountTextInput's
// LINE_HEIGHT_RATIO so input and read-only display wrap identically.
const LINE_HEIGHT_RATIO = 1.2;

/**
 * Read-only counterpart to AmountTextInput (transaction detail balance, home
 * balance, ...), using the same shrink-first-then-wrap ladder (`computeAmountFontFit`).
 *
 * Intentionally NOT `<Text adjustsFontSizeToFit numberOfLines={3}>`: on iOS that
 * wraps at the base size WITHOUT shrinking, so a long amount fills three full-size lines.
 *
 * Measures its own width via `onLayout`, so callers MUST let it stretch (defaults to
 * `alignSelf: 'stretch'`); sizing to content instead feeds the measurement back on itself.
 *
 * @param {Object} props
 * @param {string} props.children - The amount string to render (value plus symbol)
 * @param {Object} [props.style] - Additional text styles (color, fontWeight, ...)
 * @param {number} [props.baseFontSize] - Starting (largest) font size
 * @param {number} [props.minFontSize] - Floor font size before wrapping
 * @returns {React.ReactElement}
 */
const AmountDisplay = ({
  children,
  style,
  baseFontSize = AMOUNT_FONT_BASE_SIZE,
  minFontSize = AMOUNT_FONT_MIN_SIZE,
  ...rest
}) => {
  const [availableWidth, setAvailableWidth] = useState(0);
  const content = children == null ? '' : String(children);
  const { fontSize } = computeAmountFontFit(
    content.length,
    availableWidth,
    baseFontSize,
    minFontSize,
  );
  const lineHeight = Math.round(fontSize * LINE_HEIGHT_RATIO);

  return (
    <Text
      numberOfLines={AMOUNT_MAX_LINES}
      onLayout={(e) => setAvailableWidth(e.nativeEvent.layout.width)}
      style={[
        { alignSelf: 'stretch', textAlign: 'center' },
        style,
        { fontSize, lineHeight },
      ]}
      {...rest}
    >
      {content}
    </Text>
  );
};

export default AmountDisplay;
