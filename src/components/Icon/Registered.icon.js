/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react'
import Svg, { Path } from 'react-native-svg'
import { BaseIcon } from './Base.icon';

/**
 * @param {SvgProps|{type: 'default'|'outline'|'fill'}} props
 *
 * @description
 * Svg converted from Figma using transaformer at https://react-svgr.com/playground/?native=true
 */
export const RegisteredIcon = (props) => (
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
        d='M12.3 21.596a9.05 9.05 0 0 1-3.626-.733 9.395 9.395 0 0 1-2.954-1.99 9.405 9.405 0 0 1-1.988-2.951A9.034 9.034 0 0 1 3 12.3a9.05 9.05 0 0 1 .733-3.626 9.395 9.395 0 0 1 1.99-2.954 9.406 9.406 0 0 1 2.951-1.988A9.034 9.034 0 0 1 12.296 3a9.05 9.05 0 0 1 3.626.733 9.394 9.394 0 0 1 2.954 1.99 9.406 9.406 0 0 1 1.988 2.951 9.034 9.034 0 0 1 .732 3.622 9.05 9.05 0 0 1-.733 3.626 9.395 9.395 0 0 1-1.99 2.954 9.405 9.405 0 0 1-2.951 1.988 9.033 9.033 0 0 1-3.622.732Zm-.002-1.399c2.198 0 4.064-.767 5.598-2.3 1.534-1.534 2.301-3.4 2.301-5.599 0-2.198-.767-4.064-2.3-5.598-1.534-1.534-3.4-2.301-5.599-2.301-2.198 0-4.064.767-5.598 2.3-1.534 1.534-2.301 3.4-2.301 5.599 0 2.198.767 4.064 2.3 5.598 1.534 1.534 3.4 2.301 5.599 2.301Z'
      />
      <Path
        fill={props.color || '#000'}
        d='M9.87 16V8.954h2.846c1.514 0 2.422.845 2.422 2.188v.01c0 .932-.493 1.704-1.328 2.006L15.348 16h-1.44l-1.383-2.651H11.13V16h-1.26Zm1.259-3.618h1.455c.796 0 1.26-.444 1.26-1.201v-.01c0-.737-.484-1.196-1.284-1.196h-1.431v2.407Z'
      />
    </Svg>
  </BaseIcon>
);
