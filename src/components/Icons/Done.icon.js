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
export const DoneIcon = ({ size = 20, color = "#43A047" }) => (
  <Svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox={`0 0 ${size} ${size}`}
    transform={`scale(${size / 20})`}
    fill='none'
  >
    <G clipPath='url(#a)'>
      <Path
        fill={color}
        d="M40.6 12.1 17 35.7l-9.6-9.6L4.6 29 17 41.3l26.4-26.4z"
      />
    </G>
    <Defs>
      <ClipPath id='a'>
        <Path fill={color} d='M0 0h20v20H0z' />
      </ClipPath>
    </Defs>
  </Svg>
);

