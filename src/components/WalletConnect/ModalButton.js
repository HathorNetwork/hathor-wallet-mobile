import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PRIMARY_COLOR } from '../../constants';

const styles = StyleSheet.create({
  button: {
    width: 130,
    height: 40,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    borderWidth: 2,
    borderColor: '#cecece',
  },
  buttonHighlight: {
    backgroundColor: PRIMARY_COLOR,
    borderWidth: null,
    borderColor: null,
  },
  buttonText: {
    color: '#808080',
    fontSize: 12,
    fontWeight: 'bold',
  },
  buttonTextHighlight: {
    color: '#FFF',
  },
});

export default ({ onPress, title, highlight }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.button,
      highlight ? styles.buttonHighlight : null,
    ]}
  >
    <Text style={[
      styles.buttonText,
      highlight ? styles.buttonTextHighlight : null,
    ]}
    >
      {title}
    </Text>
  </TouchableOpacity>
);
