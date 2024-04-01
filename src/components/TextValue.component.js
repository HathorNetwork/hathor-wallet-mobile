import React from 'react';
import {
  StyleSheet,
  Text,
} from 'react-native';

export const TextValue = ({ bold, pb4, title, children }) => (
  <Text style={[
    styles.textValue,
    title && styles.title,
    bold && styles.bold,
    pb4 && styles.pb4,
  ]}
  >{children}</Text>
);

const styles = StyleSheet.create({
  textValue: {
    fontSize: 14,
    lineHeight: 20,
    color: 'black',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pb4: {
    paddingBottom: 4,
  },
  bold: {
    fontWeight: 'bold',
  },
});
