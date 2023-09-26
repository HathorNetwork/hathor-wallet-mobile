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
import { COLORS } from '../styles/themes';

export default class SlideIndicatorBar extends Component {
  style = StyleSheet.create({
    view: {
      height: 4,
      width: 48,
      position: 'absolute',
      backgroundColor: COLORS.textColorShadowLight,
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
