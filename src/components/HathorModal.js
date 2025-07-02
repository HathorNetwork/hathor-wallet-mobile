/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  PanResponder,
} from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../styles/themes';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const HathorModal = (props) => {
  const [visible, setVisible] = useState(true);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const animateIn = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    panY.setValue(0);
  }, [slideAnim, panY]);

  useEffect(() => {
    animateIn();
  }, [animateIn]);

  const handleDismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      if (props.onDismiss) props.onDismiss();
    });
  }, [slideAnim, props]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderMove: Animated.event([
        null,
        { dy: panY },
      ], { useNativeDriver: false }),
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 100) {
          handleDismiss();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType='none'
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modal}
      >
        <Animated.View
          style={[
            StyleSheet.compose(styles.view, props.viewStyle),
            {
              transform: [
                { translateY: slideAnim },
                { translateY: panY },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {props.children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  view: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 42,
    minHeight: 290,
    marginHorizontal: 16,
    marginBottom: 16,
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
