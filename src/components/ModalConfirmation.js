/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Dimensions, Image, StyleSheet, TouchableWithoutFeedback, View,
} from 'react-native';

import checkLogo from '../assets/images/icCheckBig.png';
import { getKeyboardAvoidingViewTopDistance } from '../utils';
import { COLORS } from '../styles/themes';

class ModalConfirmation extends React.Component {
  /**
   * show {boolean} If should show the modal component
   */
  state = {
    show: false,
  }

  show = () => {
    this.setState({ show: true }, () => {
      if (this.props.onShow) {
        this.props.onShow();
      }
    });
  }

  hide = () => {
    this.setState({ show: false }, () => {
      if (this.props.onHide) {
        this.props.onHide();
      }
    });
  }

  render() {
    if (!this.state.show) {
      return null;
    }

    const { width } = Dimensions.get('window');

    // Prevents the bottom message from being covered
    const styles = StyleSheet.create({
      modal: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
        alignItems: 'center',
        zIndex: 3,
        height: '100%',
        width: '100%',
      },
      innerModal: {
        marginBottom: 32,
        height: 270,
        backgroundColor: COLORS.backgroundColor,
        alignItems: 'center',
        justifyContent: 'space-around',
        borderRadius: 8,
        padding: 16,
        width: width - 32,
      },
    });
    return (
      <TouchableWithoutFeedback onPress={this.hide}>
        <View style={styles.modal}>
          <View style={styles.innerModal}>
            <Image source={checkLogo} style={{ height: 105, width: 105 }} resizeMode='contain' />
            {this.props.body}
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  }
}

export default ModalConfirmation;
