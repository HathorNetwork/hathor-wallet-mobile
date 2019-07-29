/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Component } from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

export default class SlideIndicatorBar extends Component {
  style = StyleSheet.create({
    view: {
      height: 4,
      width: 48,
      position: 'absolute',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: 2,
      top: 8,
      alignSelf: 'center',
    },
  });

  render() {
    return (
      <View style={this.style.view} />
    );
  }
}
