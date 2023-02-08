/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet, View,
} from 'react-native';
import PropTypes from 'prop-types';
import Modal from 'react-native-modal';

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
    <View style={props.viewStyle || styles.view}>
      {props.children}
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
  },
  view: {
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 56,
    paddingTop: 48,
    height: 290,
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
