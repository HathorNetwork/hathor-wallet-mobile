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
import { COLORS, STYLE } from '../styles/themes';

const HathorHeader = ({
  title,
  rightElement,
  withLogo,
  withBorder,
  wrapperStyle,
  onBackPress,
  onCancel,
}) => {
  return (
    <View style={[styles.wrapper, wrapperStyle, applyExtraStyle(withBorder)]}>
      <View style={styles.innerWrapper}>
        <LeftComponent onBackPress={onBackPress} />
        <CentralComponent title={title} withLogo={withLogo} />
        <RightComponent rightElement={rightElement} onCancel={onCancel} />
      </View>
    </View>
  );
};

const CancelButton = () => (
  <SimpleButton
    icon={closeIcon}
    onPress={onCancel}
  />
);

const LeftComponent = ({ onBackPress }) => {
  if (onBackPress) {
    return (
      <View style={[styles.iconWrapper, { justifyContent: 'flex-start' }]}>
        <TouchableOpacity onPress={onBackPress}>
          <Image source={chevronLeft} width={24} height={24} />
        </TouchableOpacity>
      </View>
    );
  }
  return <View style={styles.iconWrapper} />;
};

const CentralComponent = ({ title, withLogo }) => {
  if (withLogo) {
    return (
      <Logo
        style={{ height: 22, width: 100 }}
      />
    );
  }
  return <Text>{title}</Text>;
};

const RightComponent = ({ rightElement, onCancel }) => {
  const element = (onCancel ? <CancelButton /> : rightElement);
  return (
    <View style={[styles.iconWrapper, { justifyContent: 'flex-end' }]}>
      {element}
    </View>
  );
};

const applyExtraStyle = (withBorder) => {
  if (withBorder) {
    return { borderBottomWidth: 1 };
  }
  return {};
};

const styles = StyleSheet.create({
  wrapper: {
    height: STYLE.headerHeight,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderColor: COLORS.borderColor,
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
