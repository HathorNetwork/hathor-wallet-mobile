/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { TextInput } from 'react-native';

const HathorTextInput = (props) => (
  <TextInput
    {...props}
    style={[{
      width: 100, padding: 8, borderRadius: 4, borderColor: 'gainsboro', borderWidth: 1,
    }, props.style]}
    keyboardAppearance='dark'
  />
);

export default HathorTextInput;
