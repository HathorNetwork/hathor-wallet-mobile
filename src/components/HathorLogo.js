import React from 'react';
import { Image } from 'react-native';

const HathorLogo = props => {
  return (
    <Image
      source={require('../assets/images/hathor-logo.png')}
      style={{height: 60}}
      resizeMode={"center"}
      {...props}
    />
  )
}

export default HathorLogo;
