/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { setWalletConnectModal } from '../../actions';

export const ConnectModal = ({
  onAcceptAction,
  onRejectAction,
  onDismiss,
  data,
}) => {
  const dispatch = useDispatch();
  const { proposer, description, requiredNamespaces } = data;

  const onAccept = () => {
    console.log('WILL ACCEPT');
    onDismiss();
    dispatch(onAcceptAction);
  };

  const onReject = () => {
    onDismiss();
    dispatch(onRejectAction);
  };

  return (
    <Modal animationType="fade" transparent={true} visible={show}>
      <View style={styles.modalContainer}>
        <View style={styles.modalBox}>
          <Text style={styles.modalMessage}>
            {proposer} wants to connect.
          </Text>
          <Text style={styles.modalMessage}>
            {description}
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={onReject} style={[styles.button, styles.rejectButton]}>
              <Text style={styles.buttonText}>
                Reject
              </Text>
            </TouchableOpacity>
            <View style={styles.buttonSpace} />
            <TouchableOpacity onPress={onAccept} style={[styles.button, styles.acceptButton]}>
              <Text style={styles.buttonText}>
                Accept
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default () => {
  console.log('Will render.');
  const dispatch = useDispatch();
  const walletConnectModal = useSelector((state) => state.walletConnectModal);
  const onDismiss = () => {
    console.log('Dismiss!');
    dispatch(setWalletConnectModal({ show: false }));
  };

  console.log('Modal: ', walletConnectModal);

  const getModal = (type) => {
    switch(type) {
      case WalletConnectModalTypes.CONNECT:
        return <ConnectModal { ...walletConnectModal } onDismiss={onDismiss} />
      default:
        return null;
    }
  }

  return getModal(walletConnectModal.type);
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    width: 300,
  },
  modalMessage: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSpace: {
    width: 10,
  },
  button: {
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  acceptButton: {
    backgroundColor: '#1E88E5',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  rejectButton: {
    backgroundColor: '#EF5350',
  },
  rejectButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export const WalletConnectModalTypes = {
  CONNECT: 'CONNECT',
};
