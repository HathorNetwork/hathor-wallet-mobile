import React from 'react';
import { Button, View } from 'react-native';

const HathorButton = props => {
  return (
    <View style={props.style ? props.style : null}>
      <Button
        {...props}
        color="#0273a0"
      />
    </View>
  )
}

export default HathorButton;