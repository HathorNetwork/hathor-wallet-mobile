/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import SimpleButton from './SimpleButton';
import Logo from './Logo';
import chevronLeft from '../assets/icons/chevron-left.png';
import closeIcon from '../assets/icons/icCloseActive.png';

const HathorHeader = (props) => {
  const renderBackButton = () => {
    if (props.onBackPress) {
      return (
        <View style={[styles.iconWrapper, { justifyContent: 'flex-start' }]}>
          <TouchableOpacity onPress={props.onBackPress}>
            <Image source={chevronLeft} width={24} height={24} />
          </TouchableOpacity>
        </View>
      );
    }
    return <View style={styles.iconWrapper} />;
  };

  const CancelButton = () => (
    <SimpleButton
      icon={closeIcon}
      onPress={props.onCancel}
    />
  );

  const renderHeaderRight = () => {
    const element = (props.onCancel ? <CancelButton /> : props.rightElement);
    return (
      <View style={[styles.iconWrapper, { justifyContent: 'flex-end' }]}>
        {element}
      </View>
    );
  };

  const renderHeaderCentral = () => {
    if (props.withLogo) {
      return (
        <Logo
          style={{ height: 22, width: 100 }}
        />
      );
    }
    return <Text>{props.title}</Text>;
  };

  let extraStyle = {};
  if (props.withBorder) {
    extraStyle = { borderBottomWidth: 1 };
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
