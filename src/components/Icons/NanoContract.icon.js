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
 * @param {object} props
 * @property {SvgProps|{type: 'default'|'outline'|'fill'}} props.type
 * @property {number} props.size
 * @property {StyleSheet} props.color
 *
 * @description
 * Svg converted from Figma using transaformer at https://react-svgr.com/playground/?native=true
 */
export const NanoContractIcon = ({ type = 'default', size = DEFAULT_ICON_SIZE, color = COLORS.black }) => (
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
        d='M6.101 21.298a2.33 2.33 0 0 1-1.697-.69 2.278 2.278 0 0 1-.702-1.689v-1.198c0-.47.167-.871.501-1.205a1.644 1.644 0 0 1 1.206-.502H6.5V4.41c0-.47.167-.871.501-1.206a1.643 1.643 0 0 1 1.206-.501H18.59c.47 0 .871.167 1.206.501.334.335.501.736.501 1.206v14.51c0 .665-.234 1.228-.702 1.688a2.33 2.33 0 0 1-1.697.691H6.101ZM17.899 19.9c.283 0 .52-.094.712-.282a.938.938 0 0 0 .288-.698V4.41a.3.3 0 0 0-.087-.221.3.3 0 0 0-.22-.087H8.206a.3.3 0 0 0-.221.087.3.3 0 0 0-.087.22v11.606h7.314c.469 0 .87.168 1.205.502.334.334.501.736.501 1.205v1.198c0 .278.094.51.282.698.188.188.42.282.698.282ZM9.894 8.49a.676.676 0 0 1-.496-.205.674.674 0 0 1-.206-.494c0-.193.069-.357.206-.494a.677.677 0 0 1 .496-.206h7.015a.67.67 0 0 1 .49.206.671.671 0 0 1 .207.492c0 .194-.069.36-.206.496a.672.672 0 0 1-.491.205H9.894Zm0 2.885a.676.676 0 0 1-.496-.206.674.674 0 0 1-.206-.494c0-.192.069-.357.206-.494a.677.677 0 0 1 .496-.205h7.015a.67.67 0 0 1 .49.206.671.671 0 0 1 .207.491c0 .194-.069.36-.206.497a.671.671 0 0 1-.491.205H9.894Zm-3.791 8.524h9.417v-2.178a.3.3 0 0 0-.086-.221.3.3 0 0 0-.221-.087H5.409a.3.3 0 0 0-.221.087.3.3 0 0 0-.087.221v1.198c0 .278.096.51.288.698a.98.98 0 0 0 .714.282Zm-.005 0h-.997 10.42-9.423Z'
      />
    </Svg>
  </BaseIcon>
);
