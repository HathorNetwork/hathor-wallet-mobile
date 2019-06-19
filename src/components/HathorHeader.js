import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons'

const HathorHeader = props => {
  const renderBackButton = () => {
    if (props.onBackPress) {
      return (
        <View style={styles.iconWrapper}>
          <TouchableOpacity onPress={props.onBackPress}>
            <FontAwesomeIcon icon={ faChevronLeft } />
          </TouchableOpacity>
        </View>
      )
    } else {
      return (
        <View style={styles.iconWrapper}></View>
      )
    }
  }

  return (
    <View style={[styles.wrapper, props.wrapperStyle]}>
      {renderBackButton()}
      <Text>{props.title}</Text>
      <View style={styles.iconWrapper}></View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    height: 56,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 16,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    width: 24,
  }
});

export default HathorHeader;
