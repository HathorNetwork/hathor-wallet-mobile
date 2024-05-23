/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import Svg, { Path } from 'react-native-svg'
import { COLORS } from '../../styles/themes'
import { DEFAULT_ICON_SIZE } from './constants'
import { getScale, getViewBox } from './helper'

/**
 * @param {object} props
 * @property {number} props.size
 * @property {StyleSheet} props.color
 *
 * @description
 * Svg converted from Figma using transaformer at https://react-svgr.com/playground/?native=true
 */
export const CircleClock = ({ size = DEFAULT_ICON_SIZE, color = COLORS.black }) => (
  <Svg
    xmlns='http://www.w3.org/2000/svg'
    width={size}
    height={size}
    viewBox={getViewBox(size)}
    transform={getScale(size, DEFAULT_ICON_SIZE)}
    fill='none'
  >
    <Path
      fill={color}
      d='M12.71 11.716V7.758a.67.67 0 0 0-.206-.492.67.67 0 0 0-.492-.205.675.675 0 0 0-.496.205.671.671 0 0 0-.205.492v4.177a.83.83 0 0 0 .251.6l3.4 3.413a.668.668 0 0 0 .486.212.674.674 0 0 0 .504-.213.678.678 0 0 0 .212-.494.692.692 0 0 0-.211-.498l-3.243-3.239Zm-.708 9.582a9.049 9.049 0 0 1-3.626-.733 9.395 9.395 0 0 1-2.954-1.99 9.407 9.407 0 0 1-1.988-2.951 9.034 9.034 0 0 1-.732-3.622 9.05 9.05 0 0 1 .733-3.626 9.395 9.395 0 0 1 1.99-2.954 9.405 9.405 0 0 1 2.951-1.988 9.034 9.034 0 0 1 3.622-.732 9.05 9.05 0 0 1 3.626.733 9.394 9.394 0 0 1 2.954 1.99 9.406 9.406 0 0 1 1.988 2.951 9.034 9.034 0 0 1 .732 3.622 9.05 9.05 0 0 1-.733 3.626 9.395 9.395 0 0 1-1.99 2.954 9.407 9.407 0 0 1-2.951 1.988 9.034 9.034 0 0 1-3.622.732ZM12 19.9c2.185 0 4.047-.77 5.588-2.311 1.54-1.54 2.311-3.403 2.311-5.588s-.77-4.047-2.311-5.588c-1.54-1.54-3.403-2.311-5.588-2.311s-4.047.77-5.588 2.311C4.872 7.952 4.101 9.815 4.101 12s.77 4.047 2.311 5.588c1.54 1.54 3.403 2.311 5.588 2.311Z'
    />
  </Svg>
)
