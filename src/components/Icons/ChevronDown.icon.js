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
 * Down-pointing chevron used for collapsible "expand to reveal more"
 * affordances (e.g. the Fees breakdown row on the Send Confirmation
 * screen and the Tx Detail bottom sheet).
 */
export const ChevronDownIcon = ({ type, size = DEFAULT_ICON_SIZE, color = 'black' }) => (
  <BaseIcon type={type}>
    <Svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
    >
      <Path
        d='M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z'
        fill={color}
      />
    </Svg>
  </BaseIcon>
);
