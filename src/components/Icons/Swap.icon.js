/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import Svg, { Path } from 'react-native-svg'
import { disableFeaturesIfNeeded } from '../../sagas/helpers';
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
export const SwapIcon = ({ type, size = DEFAULT_ICON_SIZE, color = 'hsla(180, 85%, 34%, 1)' }) => (
  <BaseIcon type={type}>
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      width={DEFAULT_ICON_SIZE}
      height={DEFAULT_ICON_SIZE}
      viewBox={getViewBox(size)}
      transform={getScale(size, DEFAULT_ICON_SIZE)}
      fill="none"
    >
      <Path
        fill={color}
        d="M7.154 21.5 3.5 17.846l3.654-3.654 1.054 1.085-1.82 1.82h10.766v-4h1.5v5.499H6.389l1.819 1.82L7.154 21.5ZM5.346 10.904v-5.5h12.265l-1.819-1.82L16.846 2.5 20.5 6.154l-3.654 3.654-1.054-1.085 1.82-1.82H6.845v4h-1.5Z"
      />
    </Svg>
  </BaseIcon>
);
