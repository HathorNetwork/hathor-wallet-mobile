/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import Svg, { Mask, Path } from 'react-native-svg'
import { COLORS } from '../../styles/themes'
import { DEFAULT_ICON_SIZE } from './constants'
import { getScale, getViewBox } from './helper'

export const CircleCheck = ({ size = DEFAULT_ICON_SIZE, color = COLORS.black }) => (
  <Svg
    xmlns='http://www.w3.org/2000/svg'
    width={size}
    height={size}
    viewBox={getViewBox(size)}
    transform={getScale(size, DEFAULT_ICON_SIZE)}
    fill='none'
  >
    <Mask id='a' fill={COLORS.white}>
      <Path
        fillRule='evenodd'
        d='M19.5 12a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Zm1.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5-1.94A.75.75 0 0 0 14.94 9l-4.44 4.44L9.06 12A.75.75 0 0 0 8 13.06l2.5 2.5 5.5-5.5Z'
        clipRule='evenodd'
      />
    </Mask>
    <Path
      fill={color}
      fillRule='evenodd'
      d='M19.5 12a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Zm1.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5-1.94A.75.75 0 0 0 14.94 9l-4.44 4.44L9.06 12A.75.75 0 0 0 8 13.06l2.5 2.5 5.5-5.5Z'
      clipRule='evenodd'
    />
    <Path
      fill={color}
      d='m16 9-1.06 1.06L16 9Zm0 1.06L14.94 9 16 10.06ZM14.94 9 16 10.06 14.94 9Zm-4.44 4.44L9.44 14.5l1.06 1.06 1.06-1.06-1.06-1.06ZM9.06 12 8 13.06 9.06 12ZM8 12l1.06 1.06L8 12Zm0 1.06L9.06 12 8 13.06Zm2.5 2.5-1.06 1.061 1.06 1.061 1.06-1.06-1.06-1.061ZM12 21a9 9 0 0 0 9-9h-3a6 6 0 0 1-6 6v3Zm-9-9a9 9 0 0 0 9 9v-3a6 6 0 0 1-6-6H3Zm9-9a9 9 0 0 0-9 9h3a6 6 0 0 1 6-6V3Zm9 9a9 9 0 0 0-9-9v3a6 6 0 0 1 6 6h3Zm-9 10.5c5.799 0 10.5-4.701 10.5-10.5h-3a7.5 7.5 0 0 1-7.5 7.5v3ZM1.5 12c0 5.799 4.701 10.5 10.5 10.5v-3A7.5 7.5 0 0 1 4.5 12h-3ZM12 1.5C6.201 1.5 1.5 6.201 1.5 12h3A7.5 7.5 0 0 1 12 4.5v-3ZM22.5 12c0-5.799-4.701-10.5-10.5-10.5v3a7.5 7.5 0 0 1 7.5 7.5h3Zm-7.56-1.94a.75.75 0 0 1 0-1.06l2.12 2.121a2.25 2.25 0 0 0 0-3.182l-2.12 2.122Zm1.06 0a.75.75 0 0 1-1.06 0l2.12-2.12a2.25 2.25 0 0 0-3.181 0L16 10.06Zm-4.44 4.44L16 10.06 13.88 7.94l-4.44 4.439 2.122 2.121ZM8 13.06l1.44 1.44 2.12-2.121-1.439-1.44-2.12 2.122Zm1.06 0a.75.75 0 0 1-1.06 0l2.121-2.12a2.25 2.25 0 0 0-3.182 0l2.122 2.12Zm0-1.06a.75.75 0 0 1 0 1.06l-2.12-2.12a2.25 2.25 0 0 0 0 3.181l2.12-2.12Zm2.5 2.5L9.06 12l-2.12 2.121 2.5 2.5 2.12-2.12ZM14.94 9l-5.5 5.5 2.12 2.121 5.5-5.5-2.12-2.12Z'
      mask='url(#a)'
    />
  </Svg>
)
