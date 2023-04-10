/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';
import { Image, View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { PRIMARY_COLOR } from '../../constants';
import { hideWalletConnectModal } from '../../actions';

const Button = ({ onPress, title, highlight }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.button,
      highlight ? styles.buttonHighlight : null,
    ]}>
    <Text style={[
      styles.buttonText,
      highlight ? styles.buttonTextHighlight : null,
    ]}>
      {title}
    </Text>
  </TouchableOpacity>
);

export const SignMessageModal = ({
  onAcceptAction,
  onRejectAction,
  onDismiss,
  data,
}) => {
  const dispatch = useDispatch();
  const {
    icon,
    proposer,
    url,
    message,
  } = data;

  const onAccept = () => {
    onDismiss();
    dispatch(onAcceptAction);
  };

  const onReject = () => {
    onDismiss();
    dispatch(onRejectAction);
  };

  return (
    <Modal animationType="fade" transparent={true} visible={true}>
      <View style={styles.modalContainer}>
        <View style={styles.modalBox}>
          <Image style={styles.modalImage} source={{ uri: icon }} />
          <Text style={styles.modalUrl}>
            {url}
          </Text>
          <Text style={styles.modalProposer}>
            {proposer}
          </Text>
          <Text style={styles.modalHeader}>
            { t`Sign this message?` }
          </Text>
          <Text style={styles.signMessageText}>
            { message }
          </Text>
          <Text style={styles.modalText}>
            { t`By clicking approve, you will sign the requested message using the first address derived from your root key on the m/44'/280'/0'/0/0 derivation path.` }
          </Text>
          <View style={styles.buttonContainer}>
            <Button title={t`Reject`} onPress={onReject} />
            <Button highlight title={t`Approve`} onPress={onAccept} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const ConnectModal = ({
  onAcceptAction,
  onRejectAction,
  onDismiss,
  data,
}) => {
  const dispatch = useDispatch();
  const {
    icon,
    proposer,
    url,
  } = data;

  const onAccept = () => {
    onDismiss();
    dispatch(onAcceptAction);
  };

  const onReject = () => {
    onDismiss();
    dispatch(onRejectAction);
  };

  return (
    <Modal animationType='fade' transparent visible>
      <View style={styles.modalContainer}>
        <View style={styles.modalBox}>
          <Image style={styles.modalImage} source={{ uri: icon }} />
          <Text style={styles.modalUrl}>
            {url}
          </Text>
          <Text style={styles.modalProposer}>
            {proposer}
          </Text>
          <Text style={styles.modalHeader}>
            { t`Connect to this dApp?` }
          </Text>
          <Text style={styles.modalText}>
            { t`By clicking connect, you allow this dapp to receive your wallet's public address. Please validate the URL and the dApp name, this is an important security step to protect your data from potential phishing risks.` }
          </Text>
          <View style={styles.buttonContainer}>
            <Button title={t`Reject`} onPress={onReject} />
            <Button highlight title={t`Approve`} onPress={onAccept} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default () => {
  const dispatch = useDispatch();
  const walletConnectModal = useSelector((state) => state.walletConnectModal);

  if (!walletConnectModal.show) {
    return null;
  }

  const onDismiss = () => {
    dispatch(hideWalletConnectModal());
  };

  const getModal = (type) => {
    switch(type) {
      case WalletConnectModalTypes.CONNECT:
        return <ConnectModal { ...walletConnectModal } onDismiss={onDismiss} />
      case WalletConnectModalTypes.SIGN_MESSAGE:
        return <SignMessageModal { ...walletConnectModal } onDismiss={onDismiss} />
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
  modalImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 10,
  },
  modalUrl: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalProposer: {
    fontSize: 12,
    marginBottom: 16,
  },
  modalHeader: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 12,
    marginBottom: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: 130,
    height: 40,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    borderWidth: 2,
    borderColor: '#cecece',
  },
  buttonHighlight: {
    backgroundColor: PRIMARY_COLOR,
    borderWidth: null,
    borderColor: null,
  },
  buttonText: {
    color: '#808080',
    fontSize: 12,
    fontWeight: 'bold',
  },
  buttonTextHighlight: {
    color: '#FFF',
  },
  signMessageText: {
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    width: '100%',
    height: 100,
    borderRadius: 15,
    padding: 8,
    marginBottom: 12,
    marginTop: 12,
  },
});

export const WalletConnectModalTypes = {
  CONNECT: 'CONNECT',
  SIGN_MESSAGE: 'SIGN_MESSAGE',
};
