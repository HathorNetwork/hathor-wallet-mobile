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

/**
 * @param {object} props
 * @property {number} props.size
 * @property {string} props.color
 *
 * @description
 * Svg converted from Figma using transaformer at https://react-svgr.com/playground/?native=true
 */
export const CircleCheck = ({ size = DEFAULT_ICON_SIZE, color = COLORS.black }) => (
  <Svg
    xmlns='http://www.w3.org/2000/svg'
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
  >
    <Path
      fill={color}
      fillRule='evenodd'
      d='M19.5 12a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Zm1.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5-1.94A.75.75 0 0 0 14.94 9l-4.44 4.44L9.06 12A.75.75 0 0 0 8 13.06l2.5 2.5 5.5-5.5Z'
      clipRule='evenodd'
    />
  </Svg>
)
