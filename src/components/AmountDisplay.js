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

// Rendered line height as a fraction of the font size. Kept in sync with
// AmountTextInput's LINE_HEIGHT_RATIO so the editable input and the read-only
// display size and wrap identically.
const LINE_HEIGHT_RATIO = 1.2;

/**
 * Read-only counterpart to AmountTextInput for displaying amounts (transaction
 * detail balance, home balance, ...). It applies the same shrink-first-then-wrap
 * ladder (`computeAmountFontFit`): the value shrinks from the base size toward the
 * floor to stay on one line, and only once the floor can't fit it on one line does
 * it wrap across up to AMOUNT_MAX_LINES lines.
 *
 * This is intentionally NOT a plain `<Text adjustsFontSizeToFit numberOfLines={3}>`:
 * on iOS that combination wraps at the base size WITHOUT shrinking the font, so a
 * long amount fills three lines at full size instead of getting smaller.
 *
 * It measures its own width via `onLayout`, so callers MUST let it stretch to the
 * available width (it defaults to `alignSelf: 'stretch'` for that reason). If it is
 * allowed to size to its content instead, the measurement feeds back on itself.
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
