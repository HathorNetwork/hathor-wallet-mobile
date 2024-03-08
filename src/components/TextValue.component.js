import React from 'react';
import {
  StyleSheet,
  Text,
} from 'react-native';

export const TextValue = ({ children }) => (
  <Text style={[styles.textValue]}>{children}</Text>
);

const styles = StyleSheet.create({
  textValue: {
    fontSize: 14,
    lineHeight: 20,
    color: 'black',
  },
});
