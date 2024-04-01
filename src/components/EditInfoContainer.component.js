import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity
} from 'react-native';
import { COLORS } from '../styles/themes';

import { PenIcon } from './Icon/Pen.icon';

export const EditInfoContainer = ({ center, onPress, children }) => (
  <TouchableOpacity
    style={[
      center && styles.editInfoWrapperCentered
    ]}
    onPress={onPress}
  >
    <View style={[
      styles.editInfoContainer,
      center && styles.editInfoContainerCentered,
    ]}
    >
      <View style={[
        center && styles.alignCenter,
      ]}
      >
        {children}
      </View>
      <View style={styles.editIcon}>
        <PenIcon />
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  editInfoWrapperCentered: {
    alignSelf: 'center',
  },
  editInfoContainer: {
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 40,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  editInfoContainerCentered: {
    paddingLeft: 40,
  },
  alignCenter: {
    alignItems: 'center',
  },
  editIcon: {
    position: 'absolute',
    display: 'flex',
    justifyContent: 'center',
    top: 0,
    right: 0,
    bottom: 0,
    width: 24,
    height: '100%',
    marginVertical: 8,
    marginRight: 8,
  },
});
