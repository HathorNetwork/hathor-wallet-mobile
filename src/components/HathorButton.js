/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Button, View } from 'react-native';

const HathorButton = (props) => (
  <View style={props.style ? props.style : null}>
    <Button
      {...props}
      color='#0273a0'
    />
  </View>
);

export default HathorButton;
