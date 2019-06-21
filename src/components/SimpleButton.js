import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

const SimpleButton = props => {
  return (
    <TouchableOpacity onPress={props.onPress} style={[styles.container, props.ContainerStyle]}>
      <Text style={[styles.text, props.textStyle]}>{props.title}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    color: '#E30052',
  }
});

export default SimpleButton;
