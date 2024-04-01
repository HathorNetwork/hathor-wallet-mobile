/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg'

export const ActionDotIcon = () => (
  <Svg
    xmlns='http://www.w3.org/2000/svg'
    width={24}
    height={24}
    fill='none'
  >
    <G clipPath='url(#a)' opacity={0.7}>
      <Path
        fill='#000'
        fillRule='evenodd'
        d='M6.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm7 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm5.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z'
        clipRule='evenodd'
      />
    </G>
    <Defs>
      <ClipPath id='a'>
        <Path fill='#fff' d='M0 0h24v24H0z' />
      </ClipPath>
    </Defs>
  </Svg>
)
