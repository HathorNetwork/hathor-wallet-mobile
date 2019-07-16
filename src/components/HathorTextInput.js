import React from 'react';
import { TextInput } from 'react-native';

const HathorTextInput = props => (
  <TextInput
    {...props}
    style={[{
      width: 100, padding: 8, borderRadius: 4, borderColor: 'gainsboro', borderWidth: 1,
    }, props.style]}
    keyboardAppearance='dark'
  />
);

export default HathorTextInput;
