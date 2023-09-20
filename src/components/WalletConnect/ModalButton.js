import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../styles/themes';

const styles = StyleSheet.create({
  button: {
    width: 130,
    height: 40,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    borderWidth: 2,
    borderColor: COLORS.borderColor,
  },
  buttonHighlight: {
    backgroundColor: COLORS.primary,
    borderWidth: null,
    borderColor: null,
  },
  buttonText: {
    color: COLORS.midContrastDetail,
    fontSize: 12,
    fontWeight: 'bold',
  },
  buttonTextHighlight: {
    color: COLORS.backgroundColor,
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
