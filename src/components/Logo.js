/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Image } from 'react-native';

import logo from '../assets/images/logo.png';

const Logo = (props) => (
  <Image
    source={logo}
    style={[{ height: 30, width: 170 }, props.style]}
    resizeMode='contain'
    {...props}
  />
);

export default Logo;
