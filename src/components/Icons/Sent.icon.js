/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg'
import { COLORS } from '../../styles/themes';
import { BaseIcon } from './Base.icon';
import { DEFAULT_ICON_SIZE } from './constants';
import { getScale, getViewBox } from './helper';

/**
 * @param {object} props
 * @param {'default'|'outline'|'fill'} props.type
 * @property {number} props.size
 * @property {string} props.color
 * @property {string} props.backgroundColor
 *
 * @description
 * Svg converted from Figma using transaformer at https://react-svgr.com/playground/?native=true
 */
export const SentIcon = ({ type = 'default', size = DEFAULT_ICON_SIZE, color = COLORS.black, backgroundColor = COLORS.white }) => (
  <BaseIcon type={type}>
    <Svg
      xmlns='http://www.w3.org/2000/svg'
      width={DEFAULT_ICON_SIZE}
      height={DEFAULT_ICON_SIZE}
      viewBox={getViewBox(size)}
      transform={getScale(size, DEFAULT_ICON_SIZE)}
      fill='none'
    >
      <G clipPath='url(#a)'>
        <Path
          fill={color}
          fillRule='evenodd'
          d='M18.739 13.216V4.731h-8.485a.75.75 0 1 0 0 1.5h5.924L5.261 17.148a.75.75 0 1 0 1.06 1.06L17.24 7.293v5.924a.75.75 0 1 0 1.5 0Z'
          clipRule='evenodd'
        />
      </G>
      <Defs>
        <ClipPath id='a'>
          <Path
            fill={backgroundColor}
            d='M0 0h24v24H0z'
          />
        </ClipPath>
      </Defs>
    </Svg>
  </BaseIcon>
);
