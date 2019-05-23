import React from 'react';
import { Image } from 'react-native';

const HathorLogo = props => {
  return (
    <Image
      source={require('../assets/images/hathor-logo.png')}
      style={{height: 30}}
      resizeMode={"contain"}
      {...props}
    />
  )
}

export default HathorLogo;
