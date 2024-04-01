/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import Svg, { SvgProps, Path } from 'react-native-svg'
import { BaseIcon } from './Base.icon';

/**
 * @param {SvgProps|{type: 'default'|'outline'|'fill'}} props
 *
 * @description
 * Svg converted from Figma using transaformer at https://react-svgr.com/playground/?native=true
 */
export const PenIcon = (props) => (
  <BaseIcon type={props.type || 'default'}>
    <Svg
      xmlns='http://www.w3.org/2000/svg'
      width={24}
      height={24}
      fill='none'
      {...props}
    >
      <Path
        fill={props.color || '#000'}
        d='M5.1 18.9h1.182L16.538 8.65 15.35 7.462 5.1 17.726v1.173Zm-.542 1.398a.825.825 0 0 1-.606-.25.825.825 0 0 1-.25-.606v-1.6a1.713 1.713 0 0 1 .507-1.213L16.73 4.1c.137-.125.29-.223.456-.293.167-.07.344-.105.53-.105a1.474 1.474 0 0 1 1.022.413L19.9 5.284c.138.136.24.29.303.463a1.518 1.518 0 0 1-.001 1.065c-.065.17-.165.324-.302.46L7.371 19.792a1.704 1.704 0 0 1-1.214.506h-1.6ZM15.937 8.063l-.587-.601 1.188 1.188-.601-.587Z'
      />
    </Svg>
  </BaseIcon>
);
