/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
import { BaseIcon } from './Base.icon';
import { DEFAULT_ICON_SIZE } from './constants';

/**
 * Up-pointing chevron used for the expanded state of collapsible rows
 * (e.g. the Fees row on Send Confirmation when its breakdown is
 * showing).
 */
export const ChevronUpIcon = ({ type, size = DEFAULT_ICON_SIZE, color = 'black' }) => (
  <BaseIcon type={type}>
    <Svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
    >
      <Path
        d='M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z'
        fill={color}
      />
    </Svg>
  </BaseIcon>
);
