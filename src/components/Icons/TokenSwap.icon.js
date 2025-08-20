/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import Svg, { Path } from 'react-native-svg'
import { COLORS } from '../../styles/themes';
import { BaseIcon } from './Base.icon';
import { DEFAULT_ICON_SIZE } from './constants';
import { getScale, getViewBox } from './helper';

/**
 * @param {object} props
 * @param {'default'|'outline'|'fill'} props.type
 * @property {number} props.size
 * @property {string} props.color
 *
 * @description
 * Token swap icon with bidirectional arrows indicating token exchange
 */
export const TokenSwapIcon = ({ type = 'default', size = DEFAULT_ICON_SIZE, color = '#808080' }) => (
  <BaseIcon type={type}>
    <Svg
      xmlns='http://www.w3.org/2000/svg'
      width={DEFAULT_ICON_SIZE}
      height={DEFAULT_ICON_SIZE}
      viewBox={getViewBox(size)}
      transform={getScale(size, DEFAULT_ICON_SIZE)}
      fill='none'
    >
      <Path
        fill={color}
        d='M7.15375 21.5L3.5 17.8462L7.15375 14.1923L8.20775 15.277L6.3885 17.0962H17.1538V13.0963H18.6538V18.596H6.3885L8.20775 20.4153L7.15375 21.5ZM5.34625 10.9038V5.404H17.6115L15.7923 3.58475L16.8462 2.5L20.5 6.15375L16.8462 9.80775L15.7923 8.723L17.6115 6.90375H6.84625V10.9038H5.34625Z'
      />
    </Svg>
  </BaseIcon>
);