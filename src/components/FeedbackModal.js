import React from 'react';
import {
  StyleSheet, Text, View,
} from 'react-native';
import PropTypes from 'prop-types';
import Modal from 'react-native-modal';

const FeedbackModal = props => (
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
      {props.icon}
      <Text style={{ fontSize: 18, marginTop: 40, textAlign: 'center' }}>
        {props.text}
      </Text>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 56,
    paddingTop: 48,
    height: 290,
  },
});

FeedbackModal.propTypes = {
  // Icon used on this modal. Usually an image or the Spinner component
  icon: PropTypes.element.isRequired,

  // Text displayed on the modal
  text: PropTypes.oneOfType([PropTypes.string, PropTypes.element]).isRequired,

  // Function to execute on dismissing the modal
  onDismiss: PropTypes.func,
};

export default FeedbackModal;
