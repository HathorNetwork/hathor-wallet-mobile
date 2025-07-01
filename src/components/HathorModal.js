/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import {
  StyleSheet, View,
} from 'react-native';
import PropTypes from 'prop-types';
import Modal from 'react-native-modal';
import { COLORS } from '../styles/themes';

/**
 * Wrapper for the react-native-modal component.
 *
 * @see https://github.com/react-native-modal/react-native-modal
 * @param children Children to be rendered inside the modal
 * @param onDismiss Function to execute on dismissing the modal
 * @param viewStyle The inner view style
 * @returns {Element}
 * @constructor
 */
const HathorModal = ({ children, onDismiss, viewStyle }) => {
  const [isModalVisible, setIsModalVisible] = useState(true);
  const [areChildrenVisible, setAreChildrenVisible] = useState(false);

  /**
   * Exhibits the children of the modal only after it has stopped animating, to prevent flickering.
   * Using the `hideModalContentWhileAnimating` prop from react-native-modal did not work
   */
  const handleOnModalShow = () => {
    setAreChildrenVisible(true);
  }

  /**
   * When the modal is dismissed, we want to hide the children first to prevent flickering.
   * Immediately after that, we send the dismiss command through the `isVisible` prop.
   * This does not completely solve the flickering issue, that is a known issue with
   * react-native-modal, but only minimizes it.
   * @see https://github.com/react-native-modal/react-native-modal/issues/92
   */
  const initHidingAnimation = () => {
    if (!onDismiss) {
      // If there is no onDismiss function, this is a no-op.
      // The modal will have to be dismounted by the parent component.
      return;
    }
    setAreChildrenVisible(false);
    setTimeout(setIsModalVisible(false), 0);
  }

  /**
   * Only after the hiding animation is finished, we call the onDismiss function.
   * This avoids flickering when navigation occurs before the animation is finished.
   */
  const handleOnHide = () => {
    onDismiss();
  }

  return (
    <Modal
      isVisible={isModalVisible}
      animationIn='slideInUp'
      animationOut='slideOutDown'
      swipeDirection={['down']}
      onSwipeComplete={initHidingAnimation}
      onBackButtonPress={initHidingAnimation}
      onBackdropPress={initHidingAnimation}
      onModalShow={handleOnModalShow}
      onModalHide={handleOnHide}
      style={styles.modal}
      backdropTransitionOutTiming={0}
    >
      <View style={StyleSheet.compose(styles.view, viewStyle)}>
        { areChildrenVisible && children }
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
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
