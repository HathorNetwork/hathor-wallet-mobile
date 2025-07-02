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
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../styles/themes';

const HathorModal = (props) => (
  <Modal
    isVisible
    animationIn='slideInUp'
    swipeDirection={['down']}
    onSwipeComplete={props.onDismiss}
    onBackButtonPress={props.onDismiss}
    onBackdropPress={props.onDismiss}
    style={styles.modal}
  >
    <View style={StyleSheet.compose(styles.view, props.viewStyle)}>
      {props.children}
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  container: {
    justifyContent: 'flex-end',
  },
  view: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 42,
    minHeight: 290,
  },
});

HathorModal.propTypes = {
  // Function to execute on dismissing the modal
  onDismiss: PropTypes.func,
  // Children to be rendered inside the modal
  // It can be any renderable type
  children: PropTypes.node.isRequired,
  // The inner view style
  // eslint-disable-next-line react/forbid-prop-types
  viewStyle: PropTypes.object,
};

export default HathorModal;
