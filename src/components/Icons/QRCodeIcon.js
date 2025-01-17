/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../styles/themes';

const QRCodeIcon = ({ size = 25, color = COLORS.primary }) => (
  <Svg width={size} height={size} viewBox='0 0 25 25' fill='none'>
    <Path
      d='M3.5 10.7617V4.76172C3.5 4.47839 3.59583 4.24089 3.7875 4.04922C3.97917 3.85755 4.21667 3.76172 4.5 3.76172H10.5C10.7833 3.76172 11.0208 3.85755 11.2125 4.04922C11.4042 4.24089 11.5 4.47839 11.5 4.76172V10.7617C11.5 11.0451 11.4042 11.2826 11.2125 11.4742C11.0208 11.6659 10.7833 11.7617 10.5 11.7617H4.5C4.21667 11.7617 3.97917 11.6659 3.7875 11.4742C3.59583 11.2826 3.5 11.0451 3.5 10.7617ZM5.5 9.76172H9.5V5.76172H5.5V9.76172ZM3.5 20.7617V14.7617C3.5 14.4784 3.59583 14.2409 3.7875 14.0492C3.97917 13.8576 4.21667 13.7617 4.5 13.7617H10.5C10.7833 13.7617 11.0208 13.8576 11.2125 14.0492C11.4042 14.2409 11.5 14.4784 11.5 14.7617V20.7617C11.5 21.0451 11.4042 21.2826 11.2125 21.4742C11.0208 21.6659 10.7833 21.7617 10.5 21.7617H4.5C4.21667 21.7617 3.97917 21.6659 3.7875 21.4742C3.59583 21.2826 3.5 21.0451 3.5 20.7617ZM5.5 19.7617H9.5V15.7617H5.5V19.7617ZM13.5 10.7617V4.76172C13.5 4.47839 13.5958 4.24089 13.7875 4.04922C13.9792 3.85755 14.2167 3.76172 14.5 3.76172H20.5C20.7833 3.76172 21.0208 3.85755 21.2125 4.04922C21.4042 4.24089 21.5 4.47839 21.5 4.76172V10.7617C21.5 11.0451 21.4042 11.2826 21.2125 11.4742C21.0208 11.6659 20.7833 11.7617 20.5 11.7617H14.5C14.2167 11.7617 13.9792 11.6659 13.7875 11.4742C13.5958 11.2826 13.5 11.0451 13.5 10.7617ZM15.5 9.76172H19.5V5.76172H15.5V9.76172ZM19.5 21.7617V19.7617H21.5V21.7617H19.5ZM13.5 15.7617V13.7617H15.5V15.7617H13.5ZM15.5 17.7617V15.7617H17.5V17.7617H15.5ZM13.5 19.7617V17.7617H15.5V19.7617H13.5ZM15.5 21.7617V19.7617H17.5V21.7617H15.5ZM17.5 19.7617V17.7617H19.5V19.7617H17.5ZM17.5 15.7617V13.7617H19.5V15.7617H17.5ZM19.5 17.7617V15.7617H21.5V17.7617H19.5Z'
      fill={color}
    />
  </Svg>
);

export default QRCodeIcon;
