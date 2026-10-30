/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import Svg, { Rect } from 'react-native-svg';
import { NEXT_COLORS } from '../../multichain/chains';

// The four bar heights of the Hathor Next mark, in units: the certification weights of a
// four-validator committee (hathor-next-wallet-mobile's src/components/Brand.tsx).
const BAR_HEIGHTS = [2, 4, 3, 1];
const UNITS = 4;

/**
 * The Hathor Next mark: four bars, the tallest in the Hathor Next accent.
 *
 * @param {Object} props
 * @param {number} [props.size]
 * @param {string} [props.ink] The color of the other bars
 */
export const HathorNextMark = ({ size = 16, ink = NEXT_COLORS.ink }) => {
  // One unit is a bar's width plus its gap, in whole pixels so the bars stay crisp.
  const unit = Math.max(2, Math.round(size / UNITS));
  const width = Math.max(1, Math.round(unit * 0.6));
  const gap = unit - width;
  const box = UNITS * unit;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${box} ${box}`}>
      {BAR_HEIGHTS.map((height, index) => (
        <Rect
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          x={Math.floor(gap / 2) + index * unit}
          y={box - height * unit}
          width={width}
          height={height * unit}
          fill={index === 1 ? NEXT_COLORS.accent : ink}
        />
      ))}
    </Svg>
  );
};
