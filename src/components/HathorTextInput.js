/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { TextInput } from 'react-native';
import { COLORS } from '../styles/themes';

const HathorTextInput = (props) => (
  <TextInput
    {...props}
    style={[{
      width: 100,
      padding: 8,
      borderRadius: 4,
      borderColor: COLORS.borderColor,
      borderWidth: 1,
    }, props.style]}
    keyboardAppearance='dark'
  />
);

export default HathorTextInput;
