/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SHRINK_TEXT_TO_FIT } from '../constants';

// React Native's default font size.
const DEFAULT_FONT_SIZE = 14;

/**
 * The largest font size, from fontSize down to minimumFontSize, at which the text fits, using the
 * widths measured so far. It stops at the first size not measured yet: the next one to measure.
 *
 * @param {number} fontSize The full font size
 * @param {number} minimumFontSize The smallest font size to use
 * @param {number} availableWidth The width the text must fit in
 * @param {Object<number, number>} widths The text's width at each font size measured
 * @returns {number}
 */
export function fitFontSize(fontSize, minimumFontSize, availableWidth, widths) {
  let size = fontSize;
  while (size > minimumFontSize && widths[size] > availableWidth) {
    // Whole points, and at least one smaller, so the search always ends.
    const next = Math.min(size - 1, Math.floor((size * availableWidth) / widths[size]));
    size = Math.max(minimumFontSize, next);
  }
  return size;
}

/**
 * One line of text that shrinks its font to fit its width, down to minimumFontScale, and ends in
 * an ellipsis only below that.
 *
 * iOS uses the native adjustsFontSizeToFit. Android's (see SHRINK_TEXT_TO_FIT) shrinks far more
 * than needed, so there a hidden copy of the text is measured on a single line, and the font size
 * is lowered until it fits. Each size is measured rather than scaled from the full one because
 * Android 14+ scales large fonts non-linearly: a font 10% smaller isn't 10% narrower.
 *
 * @param {Object} props
 * @param {Object|Object[]} props.style The style of the text, with its full font size
 * @param {number} [props.minimumFontScale=0.5] The smallest fraction of the font size to use
 * @param {React.ReactNode} props.children The text
 */
const FitText = ({ style, minimumFontScale = 0.5, children }) => {
  const [availableWidth, setAvailableWidth] = useState(0);
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? DEFAULT_FONT_SIZE;
  // The widths measured for the current text; a new text or font size starts over.
  const textKey = `${fontSize}|${children}`;
  const [measured, setMeasured] = useState({ textKey, widths: {} });
  const widths = measured.textKey === textKey ? measured.widths : {};

  if (SHRINK_TEXT_TO_FIT) {
    return (
      <Text
        style={style}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={minimumFontScale}
      >
        {children}
      </Text>
    );
  }

  const size = availableWidth > 0
    ? fitFontSize(fontSize, fontSize * minimumFontScale, availableWidth, widths)
    : fontSize;
  const onMeasure = (e) => {
    const width = e.nativeEvent.lines[0]?.width ?? 0;
    setMeasured((prev) => ({
      textKey,
      widths: { ...(prev.textKey === textKey ? prev.widths : {}), [size]: width },
    }));
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => setAvailableWidth(e.nativeEvent.layout.width)}
    >
      <Text style={[style, { fontSize: size }]} numberOfLines={1}>
        {children}
      </Text>
      <View style={styles.measure} pointerEvents='none' importantForAccessibility='no-hide-descendants'>
        <Text style={[style, { fontSize: size }]} numberOfLines={1} onTextLayout={onMeasure}>
          {children}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  // Wide enough that the text never wraps or truncates, so its first line is the whole text.
  measure: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 10000,
    opacity: 0,
    alignItems: 'flex-start',
  },
});

export default FitText;
