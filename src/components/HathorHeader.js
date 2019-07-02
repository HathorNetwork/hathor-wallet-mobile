import React from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';

const HathorHeader = (props) => {
  const renderBackButton = () => {
    if (!props.onBackPress) {
      return null;
    }
    return (
      <View style={[styles.iconWrapper, { left: 0, width: 56, height: 40 }]}>
        <TouchableOpacity
          style={{
            alignSelf: 'stretch', flex: 1, paddingLeft: 16, justifyContent: 'center',
          }}
          onPress={props.onBackPress}
        >
          <FontAwesomeIcon icon={faChevronLeft} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeaderRight = () => {
    if (props.rightElement) {
      return (
        <View style={[styles.iconWrapper, { right: 0, paddingRight: 16 }]}>
          {props.rightElement}
        </View>
      );
    }
    return <View style={styles.iconWrapper} />;
  };

  return (
    <View style={[styles.wrapper, props.wrapperStyle]}>
      {renderBackButton()}
      <Text>{props.title}</Text>
      {renderHeaderRight()}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: 56,
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 16,
  },
  iconWrapper: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default HathorHeader;
