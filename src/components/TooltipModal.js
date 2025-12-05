/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';

const TooltipModal = ({ visible, onDismiss, children, message, linkText, onLinkPress }) => {
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType='fade'
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.tooltipContainer}>
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>
                  {message}
                  {linkText && (
                    <>
                      {' '}
                      <Text style={styles.linkText} onPress={onLinkPress}>
                        {linkText}
                      </Text>
                    </>
                  )}
                </Text>
                {children}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipContainer: {
    alignItems: 'center',
    maxWidth: '85%',
  },
  tooltip: {
    backgroundColor: '#3A3A3A',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  linkText: {
    color: '#6B93FF',
    textDecorationLine: 'underline',
  },
});

export default TooltipModal;
