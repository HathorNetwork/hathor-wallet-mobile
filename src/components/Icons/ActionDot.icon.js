/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg'
import { COLORS } from '../../styles/themes'
import { DEFAULT_ICON_SIZE } from './constants'
import { getScale, getViewBox } from './helper'

export const ActionDot = ({ size = DEFAULT_ICON_SIZE, color = COLORS.black }) => (
  <Svg
    xmlns='http://www.w3.org/2000/svg'
    width={DEFAULT_ICON_SIZE}
    height={DEFAULT_ICON_SIZE}
    viewBox={getViewBox(size)}
    transform={getScale(size, DEFAULT_ICON_SIZE)}
    fill='none'
  >
    <G clipPath='url(#a)' opacity={0.7}>
      <Path
        fill={color}
        fillRule='evenodd'
        d='M6.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm7 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm5.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z'
        clipRule='evenodd'
      />
    </G>
    <Defs>
      <ClipPath id='a'>
        <Path fill={COLORS.white} d='M0 0h24v24H0z' />
      </ClipPath>
    </Defs>
  </Svg>
)
