/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg'
import { COLORS } from '../../styles/themes';

/**
 * @param {object} props
 * @property {number} props.size
 * @property {StyleSheet} props.color
 *
 * @description
 * Svg converted from Figma using transaformer at https://react-svgr.com/playground/?native=true
 */
export const CircleInfoIcon = ({ size = 20, color = COLORS.white }) => (
  <Svg
    xmlns='http://www.w3.org/2000/svg'
    width={size}
    height={size}
    viewBox={`0 0 ${size} ${size}`}
    transform={`scale(${size / 20})`}
    fill='none'
  >
    <G clipPath='url(#a)'>
      <Path
        fill={color}
        d='M9.167 5.833h1.666V7.5H9.167V5.833Zm0 3.334h1.666v5H9.167v-5Zm.833-7.5A8.336 8.336 0 0 0 1.667 10c0 4.6 3.733 8.333 8.333 8.333S18.333 14.6 18.333 10 14.6 1.667 10 1.667Zm0 15A6.675 6.675 0 0 1 3.333 10 6.676 6.676 0 0 1 10 3.333 6.676 6.676 0 0 1 16.667 10 6.675 6.675 0 0 1 10 16.667Z'
      />
    </G>
    <Defs>
      <ClipPath id='a'>
        <Path fill={color} d='M0 0h20v20H0z' />
      </ClipPath>
    </Defs>
  </Svg>
);
