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
 * @property {SvgProps|{type: 'default'|'outline'|'fill'}} props.type
 * @property {number} props.size
 * @property {StyleSheet} props.color
 *
 * @description
 * Svg converted from Figma using transaformer at https://react-svgr.com/playground/?native=true
 */
export const OracleIcon = ({ type = 'default', size = DEFAULT_ICON_SIZE, color = COLORS.black }) => (
  <BaseIcon type={type}>
    <Svg
      xmlns='http://www.w3.org/2000/svg'
      width={size}
      height={size}
      viewBox={getViewBox(size)}
      transform={getScale(size, DEFAULT_ICON_SIZE)}
      fill='none'
    >
      <Path
        fill={color}
        d='M12 20.5c-.096 0-.189-.008-.28-.024a1.45 1.45 0 0 1-.261-.072c-1.98-.708-3.552-1.954-4.715-3.738C5.581 14.882 5 12.95 5 10.872V6.637c0-.34.098-.648.295-.924a1.66 1.66 0 0 1 .764-.596l5.367-2.011C11.62 3.036 11.81 3 12 3c.19 0 .383.035.579.106l5.367 2.011c.31.122.563.32.76.596.196.276.294.584.294.924v4.235c0 2.079-.581 4.01-1.744 5.794-1.163 1.784-2.734 3.03-4.712 3.738A1.558 1.558 0 0 1 12 20.5Zm0-1.302c1.64-.527 2.993-1.569 4.06-3.127 1.068-1.558 1.602-3.289 1.602-5.193v-4.25a.3.3 0 0 0-.193-.276L12.1 4.355A.27.27 0 0 0 12 4.337a.27.27 0 0 0-.101.018L6.53 6.352a.3.3 0 0 0-.193.276v4.25c0 1.904.534 3.635 1.602 5.193 1.067 1.558 2.42 2.6 4.06 3.127Z'
      />
      <Path
        fill={color}
        d='M11.339 13.422c.202-.062.423-.093.662-.093.23 0 .45.031.658.093.208.061.4.15.574.268.17.083.348.12.532.113a.683.683 0 0 0 .475-.211.607.607 0 0 0 .19-.464.507.507 0 0 0-.228-.415 3.693 3.693 0 0 0-2.206-.71c-.404-.001-.785.057-1.145.175-.36.117-.704.293-1.032.527a.509.509 0 0 0-.24.414.587.587 0 0 0 .194.469.68.68 0 0 0 .47.214c.183.008.36-.03.531-.116.174-.114.363-.202.565-.264ZM10.072 10.497a5.364 5.364 0 0 1 1.923-.336c.693 0 1.335.112 1.926.336.591.224 1.118.52 1.582.886.154.116.323.17.506.165a.671.671 0 0 0 .469-.204.587.587 0 0 0 .187-.467.597.597 0 0 0-.236-.441 7.195 7.195 0 0 0-2.032-1.177 6.697 6.697 0 0 0-2.4-.426c-.854 0-1.653.142-2.398.426a7.247 7.247 0 0 0-2.032 1.175.592.592 0 0 0-.037.912c.13.129.284.196.463.202a.776.776 0 0 0 .5-.165c.464-.366.99-.662 1.579-.886Z'
      />
    </Svg>
  </BaseIcon>
);
