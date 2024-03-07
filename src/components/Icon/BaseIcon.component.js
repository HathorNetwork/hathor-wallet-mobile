import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../styles/themes';

/**
 * @typedef {Object} Base base
 * @property {'default'|'outline'|'fill'} base.type
 * @property {StyleSheet} base.style
 * @property {ReactNode} base.children
 *
 * @param {Base}
 */
export const BaseIcon = ({ type, style , children }) => (
  <View style={[
    styles[type],
    style
  ]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  default: {},
  outline: {
    borderRadius: 8,
    borderWidth: 1.3,
    padding: 4,
  },
  fill: {
    borderRadius: 8,
    borderWidth: 1.3,
    borderColor: COLORS.primary,
    padding: 4,
    backgroundColor: COLORS.primary,
  },
});
