/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StyleProp,
  ViewStyle
} from 'react-native';
import Modal from 'react-native-modal';

import { COLORS } from '../styles/themes';
import NewHathorButton from './NewHathorButton';

const ModalBase = ({ show, onDismiss, children }) => {
  const hasChildren = children != null;

  const title = hasChildren && React.Children.toArray(children).find((child) => child.type.displayName === Title.displayName);
  const body = hasChildren && React.Children.toArray(children).find((child) => child.type.displayName === Body.displayName);
  const button = hasChildren && React.Children.toArray(children).find((child) => child.type.displayName === Button.displayName);

  return (
  <Modal
    isVisible={show}
    animationIn='slideInUp'
    swipeDirection={['down']}
    onSwipeComplete={onDismiss}
    onBackButtonPress={onDismiss}
    onBackdropPress={onDismiss}
  >
    <View style={styles.wrapper}>
      {title && title}
      {body && body}
      {button && button}
    </View>
  </Modal>
  );
};

const Title = ({ children }) => (
  <View style={styles.titleWrapper}>
    <Text style={styles.title}>
      {children}
    </Text>
  </View>
);
Title.displayName = 'ModalBaseTitle';

/**
 * @typedef {Object} Properties p
 * @property {ReactNode} p.children
 * @property {StyleProp<ViewStyle>} p.style
 *
 * @param {Properties}
 */
const Body = ({ style, children }) => (
  <View style={style}>
    {children}
  </View>
);
Body.displayName = 'ModalBaseBody';

const Button = ({ title, disabled, secondary }) => (
  <NewHathorButton title={title} {...{disabled, secondary}} />
);
Button.displayName = 'ModalBaseButton';

ModalBase.Title = Title;
ModalBase.Body = Body;
ModalBase.Button = Button;

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 8,
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
  },
  titleWrapper: {
    paddingBottom: 20,
  },
  title: {
    color: 'black',
    fontSize: 18,
    lineHeight: 20,
  },
});

export { ModalBase }
