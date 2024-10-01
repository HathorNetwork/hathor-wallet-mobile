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
import { COLORS } from '../../styles/themes';
import { NewNanoContractTransactionModal } from './NanoContract/NewNanoContractTransactionModal';
import SignOracleDataModal from './NanoContract/SignOracleDataModal';
import CreateTokenModal from './CreateTokenModal';

export default () => {
  const dispatch = useDispatch();
  const reownModal = useSelector((state) => state.reown.modal);

  if (!reownModal.show) {
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
            {...reownModal}
            onDismiss={onDismiss}
            baseStyles={baseStyles}
          />
        );
      case WalletConnectModalTypes.SIGN_MESSAGE:
        return (
          <SignMessageModal
            {...reownModal}
            onDismiss={onDismiss}
          />
        );
      case WalletConnectModalTypes.SIGN_ORACLE_DATA:
        return (
          <SignOracleDataModal
            {...reownModal}
            onDismiss={onDismiss}
          />
        );
      case WalletConnectModalTypes.SEND_NANO_CONTRACT_TX:
        return (
          <NewNanoContractTransactionModal
            {...reownModal}
            onDismiss={onDismiss}
          />
        );
      case WalletConnectModalTypes.CREATE_TOKEN:
        return (
          <CreateTokenModal
            {...reownModal}
            onDismiss={onDismiss}
          />
        );
      default:
        return null;
    }
  };

  return getModal(reownModal.type);
};

const baseStyles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.textColorShadow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: COLORS.backgroundColor,
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
  SEND_NANO_CONTRACT_TX: 'SEND_NANO_CONTRACT_TX',
  SIGN_ORACLE_DATA: 'SIGN_ORACLE_DATA',
  CREATE_TOKEN: 'CREATE_TOKEN',
};
