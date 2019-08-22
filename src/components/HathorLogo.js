/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Image } from 'react-native';

import hathorLogo from '../assets/images/hathor-logo.png';

const HathorLogo = (props) => (
  <Image
    source={hathorLogo}
    style={{ height: 30, width: 170 }}
    resizeMode='contain'
    {...props}
  />
);

export default HathorLogo;
