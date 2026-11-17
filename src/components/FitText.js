/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
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
 * Android 14+ scales large fonts non-linearly: a font 10% smaller isn't 10% narrower. While a new
 * text is being fitted, the visible one keeps the last fitted size.
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
  const [fittedSize, setFittedSize] = useState(fontSize);

  const minimumFontSize = fontSize * minimumFontScale;
  // Android 7-10 don't round the text width up, so a text that fits can measure a bit wider.
  const fitWidth = availableWidth + 1 / PixelRatio.get();
  const size = availableWidth > 0
    ? fitFontSize(fontSize, minimumFontSize, fitWidth, widths)
    : fontSize;
  const fitted = availableWidth > 0
    && widths[size] !== undefined
    && (widths[size] <= fitWidth || size <= minimumFontSize);

  useEffect(() => {
    if (fitted) {
      setFittedSize(size);
    }
  }, [fitted, size]);

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

  const visibleSize = fitted ? size : Math.min(fittedSize, fontSize);
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
      <Text style={[style, { fontSize: visibleSize }]} numberOfLines={1}>
        {children}
      </Text>
      <View style={styles.measure} pointerEvents='none' importantForAccessibility='no-hide-descendants'>
        {/* A new instance per size. Fabric drops a layout event that repeats the instance's last
            one, as when two sizes round to the same pixels, and the late events of a replaced
            instance. */}
        <Text
          key={`${textKey}|${size}`}
          style={[style, { fontSize: size }]}
          numberOfLines={1}
          onTextLayout={onMeasure}
        >
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
