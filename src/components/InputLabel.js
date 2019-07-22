import React from 'react';
import { StyleSheet, Text } from 'react-native';

const InputLabel = (props) => (
  <Text
    style={[styles.text, props.style]}
  >
    {props.children}
  </Text>
);

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    lineHeight: 14,
    color: 'rgba(0,0,0,0.5)',
  },
});

export default InputLabel;
