/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';

import { COLORS } from '../styles/themes';
import NewHathorButton from './NewHathorButton';
import BackdropModal from './BackdropModal';

const ModalBase = ({ styleModal, styleWrapper, show, onDismiss, children }) => {
  const hasChildren = children != null;

  const title = hasChildren && React.Children.toArray(children).find(
    (child) => child.type.displayName === Title.displayName
  );
  const body = hasChildren && React.Children.toArray(children).find(
    (child) => child.type.displayName === Body.displayName
  );
  const button = hasChildren && React.Children.toArray(children).find(
    (child) => child.type.displayName === Button.displayName
  );
  const discreteButton = hasChildren && React.Children.toArray(children).find(
    (child) => child.type.displayName === DiscreteButton.displayName
  );

  return (
    <BackdropModal
      visible={show}
      animationType='slide'
      position='center'
      enableBackdropPress
      onDismiss={onDismiss}
      containerStyle={styleModal}
      contentStyle={StyleSheet.compose(styles.wrapper, styleWrapper)}
    >
      {title && title}
      {body && body}
      {button && button}
      {discreteButton && discreteButton}
    </BackdropModal>
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
 * @param {Object} props
 * @property {ReactNode} props.children
 * @property {StyleProp<ViewStyle>} props.style
 */
const Body = ({ style, children }) => (
  <View style={style}>
    {children}
  </View>
);
Body.displayName = 'ModalBaseBody';

const Button = ({ title, disabled, secondary, danger, onPress }) => (
  <NewHathorButton title={title} {...{ disabled, secondary, danger, onPress }} />
);
Button.displayName = 'ModalBaseButton';

const DiscreteButton = ({ title, onPress }) => (
  <NewHathorButton title={title} discrete {...{ onPress }} wrapperStyle={styles.discreteButton} />
);
DiscreteButton.displayName = 'ModalBaseDiscreteButton';

ModalBase.Title = Title;
ModalBase.Body = Body;
ModalBase.Button = Button;
ModalBase.DiscreteButton = DiscreteButton;

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
  discreteButton: {
    marginTop: 8,
  },
});

export { ModalBase }
