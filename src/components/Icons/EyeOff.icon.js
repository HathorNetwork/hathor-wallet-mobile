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
 * @property {string} props.color
 */
export const EyeOffIcon = ({ type, size = DEFAULT_ICON_SIZE, color = 'black' }) => (
  <BaseIcon type={type}>
    <Svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
    >
      <Path
        d='M12 6.5C15.79 6.5 19.17 8.63 20.82 12C20.23 13.22 19.4 14.27 18.41 15.11L19.82 16.52C21.21 15.29 22.31 13.77 23 12C21.27 7.61 17 4.5 12 4.5C10.6 4.5 9.26 4.75 8 5.2L9.74 6.94C10.46 6.66 11.22 6.5 12 6.5ZM2.71 3.16L5.11 5.56C3.44 6.84 2.13 8.55 1.28 10.5L1 12C2.73 16.39 7 19.5 12 19.5C13.69 19.5 15.31 19.15 16.79 18.51L19.74 21.46L21.16 20.04L4.13 3.01L2.71 3.16ZM12 17.5C8.21 17.5 4.83 15.37 3.18 12C3.88 10.57 4.9 9.34 6.14 8.41L8.54 10.81C8.2 11.17 8 11.56 8 12C8 14.21 9.79 16 12 16C12.44 16 12.83 15.93 13.19 15.79L15.29 17.89C14.24 17.29 13.14 17.5 12 17.5ZM11.86 9.51L14.49 12.14C14.5 12.1 14.5 12.05 14.5 12C14.5 10.62 13.38 9.5 12 9.5C11.95 9.5 11.9 9.5 11.86 9.51Z'
        fill={color}
      />
    </Svg>
  </BaseIcon>
);
