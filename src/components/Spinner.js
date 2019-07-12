import React from 'react';
import { Animated, Easing } from 'react-native';
import PropTypes from 'prop-types';

class Spinner extends React.Component {
  static defaultProps = {
    height: 105,
    width: 105,
  };

  /**
   * spinAnimation {Animated.Value} animation for the spinner image
   */
  state = { spinAnimation: new Animated.Value(0) };

  componentDidMount(){
    Animated.loop(Animated.timing(this.state.spinAnimation, {
      toValue: 1,
      duration: 2000,
      easing: Easing.linear,
      useNativeDriver: true
    })).start();
  }

  render() {
    const spin = this.state.spinAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg']
    });

    return (
      <Animated.Image
        style={{ height: this.props.height, width: this.props.width, transform: [{rotate: spin}] }}
        source={require('../assets/images/icLoadingBig.png')} />
    );
  }
}

Spinner.propTypes = {
  // Optional (default 105). The height of the spinner
  height: PropTypes.number,

  // Optional (default 105). The width of the spinner
  width: PropTypes.number,
};

export default Spinner;
