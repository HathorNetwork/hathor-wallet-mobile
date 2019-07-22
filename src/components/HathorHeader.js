import React from 'react';
import {
  Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import hathorLogo from '../assets/images/hathor-logo.png';

const HathorHeader = (props) => {
  const renderBackButton = () => {
    if (props.onBackPress) {
      return (
        <View style={[styles.iconWrapper, { justifyContent: 'flex-start' }]}>
          <TouchableOpacity onPress={props.onBackPress}>
            <Image source={require('../assets/icons/chevron-left.png')} width={24} height={24} />
          </TouchableOpacity>
        </View>
      );
    }
    return <View style={styles.iconWrapper} />;
  };

  const renderHeaderRight = () => {
    if (props.rightElement) {
      return (
        <View style={[styles.iconWrapper, { justifyContent: 'flex-end' }]}>
          {props.rightElement}
        </View>
      );
    }
    return <View style={styles.iconWrapper} />;
  };

  const renderHeaderCentral = () => {
    if (props.withLogo) {
      return <Image
        source={hathorLogo}
        style={{ height: 22, width: 100 }}
        resizeMode="contain"
      />;
    } else {
      return <Text>{props.title}</Text>;
    }
  }

  let extraStyle = {};
  if (props.withBorder) {
    extraStyle = {borderBottomWidth: 1};
  }

  return (
    <View style={[styles.wrapper, props.wrapperStyle, extraStyle]}>
      <View style={styles.innerWrapper}>
        {renderBackButton()}
        {renderHeaderCentral()}
        {renderHeaderRight()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderColor: '#eee',
    paddingHorizontal: 16,
  },
  innerWrapper: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  iconWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default HathorHeader;
