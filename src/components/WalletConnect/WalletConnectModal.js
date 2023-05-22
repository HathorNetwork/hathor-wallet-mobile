/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { StyleSheet } from 'react-native';
import { hideWalletConnectModal } from '../../actions';
import SignMessageModal from './SignMessageModal';
import ConnectModal from './ConnectModal';

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
    switch (type) {
      case WalletConnectModalTypes.CONNECT:
        return (
          <ConnectModal
            {...walletConnectModal}
            onDismiss={onDismiss}
            baseStyles={baseStyles}
          />
        );
      case WalletConnectModalTypes.SIGN_MESSAGE:
        return (
          <SignMessageModal
            {...walletConnectModal}
            onDismiss={onDismiss}
            baseStyles={baseStyles}
          />
        );
      default:
        return null;
    }
  };

  return getModal(walletConnectModal.type);
};

const baseStyles = StyleSheet.create({
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
});

export const WalletConnectModalTypes = {
  CONNECT: 'CONNECT',
  SIGN_MESSAGE: 'SIGN_MESSAGE',
};
