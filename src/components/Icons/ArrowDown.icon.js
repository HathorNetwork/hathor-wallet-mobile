/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import Svg, { Path } from 'react-native-svg'
import { BaseIcon } from './Base.icon';
import { DEFAULT_ICON_SIZE } from './constants';
import { getScale, getViewBox } from './helper';
import { COLORS } from '../../styles/themes';

/**
 * @param {object} props
 * @property {number} props.size
 * @property {StyleSheet} props.style
 */
export const ArrowDownIcon = ({ type = 'default', size = DEFAULT_ICON_SIZE, color = COLORS.black }) => (
  <BaseIcon type={type}>
    <Svg
      width={size}
      height={size}
      viewBox={getViewBox(size)}
      transform={getScale(size, DEFAULT_ICON_SIZE)}
      fill='none'
    >
      <Path
        fill={color}
        d='M12 13.7239L16.8619 8.86195L17.8047 9.80476L12 15.6095L6.19526 9.80476L7.13807 8.86195L12 13.7239Z'
      />
    </Svg>
  </BaseIcon>
);
