
import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity
} from 'react-native';
import PropTypes from 'prop-types';
import Modal from 'react-native-modal';
import { PRIMARY_COLOR } from '../constants';

/**
 * Component that renders a modal with a title, a message and a button to perform an action.
 *
 * @example
 * <ActionModal
 *  title={this.state.modal.title}
 *  message={this.state.modal.message}
 *  button={this.state.modal.button}
 *  onPress={this.state.modal.onPress}
 *  onDismiss={this.state.modal.onDismiss}
 * />
 *
 * @param {{ title, message, button, onPress, onDismiss }} props The props of the component
 * @returns The action modal component to display
 */
const ActionModal = (props) => (
  <Modal
    isVisible
    transparent
    visible
    animationIn='slideInUp'
    swipeDirection={['down']}
    onRequestClose={props.onDismiss}
    onDismiss={props.onDismiss}
    onSwipeComplete={props.onDismiss}
    onBackButtonPress={props.onDismiss}
    onBackdropPress={props.onDismiss}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.modalTitleContainer}>
          <Text style={styles.modalTitle}>{props.title}</Text>
        </View>
        <View style={styles.modalMessageContainer}>
          <Text style={styles.modalMessage}>{props.message}</Text>
        </View>
        <View style={styles.modalButtonContainer}>
          <TouchableOpacity onPress={props.onPress}>
            <Text style={styles.modalButton}>{props.button}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

ActionModal.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  button: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  onDismiss: PropTypes.func.isRequired,
};


const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
  },
  modalTitleContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalMessageContainer: {
    marginBottom: 20,
  },
  modalMessage: {
    fontSize: 14,
  },
  modalButtonContainer: {
    alignItems: 'flex-end',
  },
  modalButton: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ActionModal;
