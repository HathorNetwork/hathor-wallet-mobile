import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons'

const HathorHeader = props => {
  const renderBackButton = () => {
    if (props.onBackPress) {
      return (
        <View style={[styles.iconWrapper, {justifyContent: 'flex-start'}]}>
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

  const renderHeaderRight = () => {
    if (props.rightElement) {
      return (
        <View style={[styles.iconWrapper, {justifyContent: 'flex-end'}]}>
          {props.rightElement}
        </View>
      );
    } else {
      return <View style={styles.iconWrapper}></View>;
    }
  }

  return (
    <View style={[styles.wrapper, props.wrapperStyle]}>
      {renderBackButton()}
      <Text>{props.title}</Text>
      {renderHeaderRight()}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    height: 56,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 16,
  },
  iconWrapper: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    height: 24,
  }
});

export default HathorHeader;
