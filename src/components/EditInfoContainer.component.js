import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity
} from 'react-native';

import { PenIcon } from './Icon/Pen.icon';

export const EditInfoContainer = ({ lastElement, onPress, children }) => (
  <TouchableOpacity
    style={[styles.editInfoWrapper, lastElement && styles.lastElement]}
    onPress={onPress}
  >
    <View style={[styles.editInfoContainer]}>
      <View>
        {children}
      </View>
      <View style={styles.editIcon}>
        <PenIcon />
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  editInfoWrapper: {
    alignSelf: 'center',
    paddingBottom: 8,
  },
  editInfoContainer: {
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 40,
    /* Adds an action context to the whole information block. */
    borderWidth: 1.3,
    borderStyle: 'dashed',
    borderColor: 'hsla(0, 0%, 88%, 1)',
    borderRadius: 8,
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

