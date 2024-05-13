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
export const WalletIcon = (props) => (
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
        d='M5.101 17.758v1.161V5.081v12.677Zm.308 2.56c-.471 0-.873-.167-1.207-.5a1.644 1.644 0 0 1-.5-1.207V5.388c0-.47.167-.873.5-1.206.334-.334.736-.5 1.207-.5h13.203c.47 0 .873.166 1.206.5.333.333.5.736.5 1.206V8.17H18.92V5.388a.3.3 0 0 0-.086-.22.3.3 0 0 0-.221-.087H5.409a.3.3 0 0 0-.221.086.3.3 0 0 0-.087.221v13.223a.3.3 0 0 0 .087.222.3.3 0 0 0 .22.086h13.203a.3.3 0 0 0 .222-.086.3.3 0 0 0 .086-.221V15.83h1.4v2.781c0 .471-.168.874-.5 1.207-.334.333-.736.5-1.207.5H5.409Zm7.938-3.96a1.68 1.68 0 0 1-1.236-.511 1.685 1.685 0 0 1-.51-1.234V9.387c0-.484.17-.896.511-1.236.341-.34.753-.51 1.234-.51h6.206c.485 0 .897.17 1.236.512.34.341.51.752.51 1.234v5.226c0 .484-.17.896-.511 1.236-.341.34-.753.51-1.234.51h-6.206Zm6.244-1.398a.3.3 0 0 0 .221-.087.3.3 0 0 0 .087-.221V9.348a.3.3 0 0 0-.087-.221.3.3 0 0 0-.22-.087h-6.284a.3.3 0 0 0-.222.087.3.3 0 0 0-.086.221v5.304a.3.3 0 0 0 .086.221.3.3 0 0 0 .222.087h6.283Zm-3.633-1.48c.413 0 .763-.144 1.05-.43.288-.287.431-.636.431-1.049 0-.412-.143-.762-.43-1.05a1.424 1.424 0 0 0-1.048-.43c-.412 0-.762.142-1.05.429a1.424 1.424 0 0 0-.431 1.049c0 .412.143.762.43 1.05.286.287.636.43 1.048.43Z'
      />
    </Svg>
  </BaseIcon>
);
