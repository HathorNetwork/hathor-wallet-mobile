import React from 'react';
import { Image } from 'react-native';

import hathorLogo from '../assets/images/hathor-logo.png';

const HathorLogo = props => (
  <Image
    source={hathorLogo}
    style={{ height: 30 }}
    resizeMode="contain"
    {...props}
  />
);

export default HathorLogo;
