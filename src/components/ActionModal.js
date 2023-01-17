/* eslint-disable max-len */
/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet, Text, View,
} from 'react-native';
import PropTypes from 'prop-types';
import Modal from 'react-native-modal';
import NewHathorButton from './NewHathorButton';

const FeedbackModal = (props) => (
  <Modal
    isVisible
    animationIn='slideInUp'
    swipeDirection={['down']}
    onSwipeComplete={props.onDismiss}
    onBackButtonPress={props.onDismiss}
    onBackdropPress={props.onDismiss}
    style={styles.modal}
  >
    <View style={styles.innerModal}>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 18, marginTop: 20, textAlign: 'center' }}>
          {props.title}
        </Text>
        <Text style={{ fontSize: 14, marginTop: 20, textAlign: 'center' }} {...props.textProps}>
          {props.text}
        </Text>
      </View>
      <View style={{ justifyContent: 'flex-end', marginTop: 60 }}>
        <NewHathorButton onPress={() => props.onAction()} title={props.button} />
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
  },
  innerModal: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingBottom: 56,
    paddingTop: 48,
    height: 290,
  },
});

FeedbackModal.propTypes = {
  // Text displayed on the modal
  title: PropTypes.string,

  // Text displayed on the modal
  text: PropTypes.oneOfType([PropTypes.string, PropTypes.element]).isRequired,

  // Function to execute on dismissing the modal
  onDismiss: PropTypes.func,

  // Text displayed on the button
  button: PropTypes.string,

  // Function to execute on pressing the button
  onAction: PropTypes.func,
};

export default FeedbackModal;
