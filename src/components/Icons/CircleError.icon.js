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
export const CircleError = ({ size = DEFAULT_ICON_SIZE, color = COLORS.black }) => (
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
      d='M11.997 16.63a.75.75 0 0 0 .55-.217.737.737 0 0 0 .22-.548.751.751 0 0 0-.217-.55.737.737 0 0 0-.547-.22.751.751 0 0 0-.55.217.737.737 0 0 0-.22.548c0 .22.072.404.217.55.145.147.327.22.547.22Zm.013-3.553a.673.673 0 0 0 .494-.206.677.677 0 0 0 .206-.496v-4.52a.67.67 0 0 0-.206-.491.67.67 0 0 0-.492-.206.675.675 0 0 0-.496.206.671.671 0 0 0-.205.49v4.521c0 .194.068.36.205.496a.674.674 0 0 0 .494.206Zm-.008 8.221a9.049 9.049 0 0 1-3.626-.733 9.395 9.395 0 0 1-2.954-1.99 9.407 9.407 0 0 1-1.988-2.951 9.034 9.034 0 0 1-.732-3.622 9.05 9.05 0 0 1 .733-3.626 9.395 9.395 0 0 1 1.99-2.954 9.405 9.405 0 0 1 2.951-1.988 9.034 9.034 0 0 1 3.622-.732 9.05 9.05 0 0 1 3.626.733 9.394 9.394 0 0 1 2.954 1.99 9.406 9.406 0 0 1 1.988 2.951 9.034 9.034 0 0 1 .732 3.622 9.05 9.05 0 0 1-.733 3.626 9.395 9.395 0 0 1-1.99 2.954 9.407 9.407 0 0 1-2.951 1.988 9.034 9.034 0 0 1-3.622.732ZM12 19.9c2.198 0 4.064-.767 5.598-2.3 1.534-1.534 2.301-3.4 2.301-5.599 0-2.198-.767-4.064-2.3-5.598C16.064 4.868 14.198 4.1 12 4.1c-2.198 0-4.064.767-5.598 2.3C4.868 7.936 4.1 9.802 4.1 12c0 2.198.767 4.064 2.3 5.598C7.936 19.132 9.802 19.9 12 19.9Z'
    />
  </Svg>
)
