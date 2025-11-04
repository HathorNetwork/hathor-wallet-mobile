/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import PropTypes from 'prop-types';
import { COLORS } from '../styles/themes';

const { height: screenHeight } = Dimensions.get('window');

/**
 * A custom modal component using pure View (no native Modal) with:
 * - Fade backdrop animation (never slides)
 * - Configurable content animation (slide, fade, none)
 * - Swipe-to-dismiss functionality
 * - Touch outside to dismiss
 * - Flexible positioning and styling
 * - Delayed children rendering to prevent flickering
 * - No native Modal issues (ghost modals, timing problems, etc.)
 */
const BackdropModal = ({
  visible,
  onDismiss,
  children,
  animationType = 'slide',
  position = 'bottom',
  enableSwipeToDismiss = true,
  enableBackdropPress = true,
  backdropColor = 'rgba(0, 0, 0, 0.5)',
  contentStyle,
  containerStyle,
  swipeThreshold = 100,
  onShow,
  onHide,
  ...modalProps
}) => {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const gestureAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  // Store the latest onDismiss in a ref so PanResponder can access it
  const onDismissRef = useRef(onDismiss);

  // Update the ref whenever onDismiss changes
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // State to control delayed children rendering
  const [showChildren, setShowChildren] = useState(false);

  // Control children visibility based on modal state
  useEffect(() => {
    if (visible) {
      // Delay showing children until after animation completes
      const timer = setTimeout(() => {
        setShowChildren(true);
      }, 100);

      return () => clearTimeout(timer);
    }

    // Hide children immediately when modal is dismissed
    setShowChildren(false);
    return undefined;
  }, [visible]);

  const handleDismiss = () => {
    const currentOnDismiss = onDismissRef.current;
    if (!currentOnDismiss) return;

    // Animate out
    const animations = [
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ];

    if (animationType === 'slide') {
      animations.push(
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }),
      );
    } else if (animationType === 'fade') {
      animations.push(
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
      );
    }

    // Reset gesture animation
    if (enableSwipeToDismiss) {
      animations.push(
        Animated.timing(gestureAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      );
    }

    Animated.parallel(animations).start(() => {
      onHide?.();
      currentOnDismiss();
    });
  };

  // Pan responder for swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enableSwipeToDismiss,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (!enableSwipeToDismiss) return false;

        // Only respond to vertical swipes
        const { dy, dx } = gestureState;
        return Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          gestureAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy > swipeThreshold || gestureState.vy > 0.5) {
          handleDismiss();
        } else {
          // Snap back to original position
          Animated.spring(gestureAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (visible) {
      // Animate in
      const animations = [
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ];

      if (animationType === 'slide') {
        animations.push(
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        );
      } else if (animationType === 'fade') {
        animations.push(
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        );
      }

      Animated.parallel(animations).start(() => {
        onShow?.();
      });
    } else {
      // Reset animations when modal becomes invisible
      backdropOpacity.setValue(0);
      slideAnim.setValue(screenHeight);
      scaleAnim.setValue(0.8);
      gestureAnim.setValue(0);
    }
  }, [
    visible,
    animationType,
    backdropOpacity,
    slideAnim,
    scaleAnim,
    gestureAnim,
    onShow,
  ]);

  const getContainerStyle = () => {
    const baseStyle = [styles.container];

    if (position === 'center') {
      baseStyle.push(styles.centerContainer);
    } else if (position === 'top') {
      baseStyle.push(styles.topContainer);
    } else {
      baseStyle.push(styles.bottomContainer);
    }

    if (containerStyle) {
      baseStyle.push(containerStyle);
    }

    return baseStyle;
  };

  const getContentTransform = () => {
    const transforms = [];

    if (animationType === 'slide') {
      transforms.push({ translateY: Animated.add(slideAnim, gestureAnim) });
    } else if (animationType === 'fade') {
      transforms.push({ scale: scaleAnim });
    }

    return transforms;
  };

  const getContentStyle = () => {
    const baseStyle = [styles.content];

    if (contentStyle) {
      baseStyle.push(contentStyle);
    }

    const transform = getContentTransform();
    if (transform.length > 0) {
      baseStyle.push({ transform });
    }

    return baseStyle;
  };

  return (
    <View
      style={styles.modalContainer}
      pointerEvents="box-none" // Allow touches to pass through to backdrop/content
    >
      <Animated.View
        style={[
          styles.backdrop,
          {
            backgroundColor: backdropColor,
            opacity: backdropOpacity,
          },
        ]}>
        <View style={getContainerStyle()}>
          {/* Backdrop touch areas */}
          {enableBackdropPress && (
            <TouchableWithoutFeedback onPress={handleDismiss}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          )}

          {/* Content area - only show when visible AND children ready */}
          {visible && showChildren && (
            <Animated.View
              style={getContentStyle()}
              {...(enableSwipeToDismiss ? panResponder.panHandlers : {})}>
              {children}
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999, // Extremely high z-index to ensure modal is always on top
    elevation: 9999, // Android elevation
  },
  backdrop: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  topContainer: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  bottomContainer: {
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  content: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 8,
    padding: 16,
    alignSelf: 'stretch',
  },
});

BackdropModal.propTypes = {
  // Whether the modal is visible
  visible: PropTypes.bool.isRequired,
  // Function to call when modal should be dismissed
  onDismiss: PropTypes.func,
  // Modal content
  children: PropTypes.node.isRequired,
  // Animation type for modal content ('slide', 'fade', 'none')
  animationType: PropTypes.oneOf(['slide', 'fade', 'none']),
  // Position of modal content ('center', 'bottom', 'top')
  position: PropTypes.oneOf(['center', 'bottom', 'top']),
  // Whether swipe to dismiss is enabled
  enableSwipeToDismiss: PropTypes.bool,
  // Whether tapping backdrop dismisses modal
  enableBackdropPress: PropTypes.bool,
  // Backdrop color
  backdropColor: PropTypes.string,
  // Custom content style
  contentStyle: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.array,
    PropTypes.number,
  ]),
  // Custom container style
  containerStyle: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.array,
    PropTypes.number,
  ]),
  // Swipe threshold for dismissing (in pixels)
  swipeThreshold: PropTypes.number,
  // Callback when modal is shown
  onShow: PropTypes.func,
  // Callback when modal is hidden
  onHide: PropTypes.func,
};

export default BackdropModal;
