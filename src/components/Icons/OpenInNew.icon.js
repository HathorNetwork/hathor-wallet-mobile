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

/**
 * Material Design "open_in_new" icon (weight 300, optical size 24).
 *
 * @param {object} props
 * @property {'default'|'outline'|'fill'} props.type
 * @property {number} props.size
 * @property {string} props.color
 */
export const OpenInNewIcon = ({ type = 'default', size = DEFAULT_ICON_SIZE, color = COLORS.primary }) => (
  <BaseIcon type={type}>
    <Svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
    >
      <Path
        fill={color}
        d='M5.4 20.1c-.495 0-.912-.17-1.253-.511A1.706 1.706 0 0 1 3.636 18.337V5.663c0-.495.17-.912.511-1.253.341-.34.758-.511 1.253-.511h5.55v1.4H5.4a.289.289 0 0 0-.212.088.289.289 0 0 0-.088.212V18.4c0 .083.03.154.088.213a.289.289 0 0 0 .212.087H18.6a.289.289 0 0 0 .212-.087.289.289 0 0 0 .088-.213V12.95h1.4v5.45c0 .495-.17.912-.511 1.253-.341.34-.758.511-1.253.511H5.4Zm4.475-5.3-.987-.988L18.1 4.6h-4.05V3.2h6.75v6.75h-1.4V5.9l-9.525 9.525v-.625Z'
      />
    </Svg>
  </BaseIcon>
);
