import React from 'react';
import { TextInput } from 'react-native';

const HathorTextInput = props => {
  return (
    <TextInput
      {...props}
      style={[{width: 100, padding: 8, borderRadius: 4, borderColor: "gainsboro", backgroundColor: "gainsboro", borderWidth: 1}, props.style]}
    />
  )
}

export default HathorTextInput;
