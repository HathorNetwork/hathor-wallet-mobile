/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Animated, Easing } from 'react-native';
import PropTypes from 'prop-types';

import loadingIcon from '../assets/images/icLoadingBig.png';

class Spinner extends React.Component {
  static defaultProps = {
    size: 105,
  };

  /**
   * spinAnimation {Animated.Value} animation for the spinner image
   */
  state = { spinAnimation: new Animated.Value(0) };

  componentDidMount() {
    Animated.loop(Animated.timing(this.state.spinAnimation, {
      toValue: 1,
      duration: 2000,
      easing: Easing.linear,
      useNativeDriver: true,
    })).start();
  }

  render() {
    const spin = this.state.spinAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <Animated.Image
        style={{ height: this.props.size, width: this.props.size, transform: [{ rotate: spin }] }}
        source={loadingIcon}
      />
    );
  }
}

Spinner.propTypes = {
  // Optional (default 105). Size of the spinner. Used for width and height
  size: PropTypes.number,
};

export default Spinner;
