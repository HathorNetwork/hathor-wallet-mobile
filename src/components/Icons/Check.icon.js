
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

/**
 * @param {object} props
 * @property {number} props.size
 * @property {StyleSheet} props.color
 */
export const CheckIcon = ({ type, size = DEFAULT_ICON_SIZE, color = 'black' }) => (
  <BaseIcon type={type}>
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill='none'
    >
      <Path d="M5 8.2L3 6.2L3.7 5.5L5 6.8L8.3 3.5L9 4.2L5 8.2Z" fill={color}/>
    </Svg>
  </BaseIcon>
);
