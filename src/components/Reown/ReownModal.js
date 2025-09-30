/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { hideReownModal } from '../../actions';
import SignMessageModal from './SignMessageModal';
import ConnectModal from './ConnectModal';
import { NewNanoContractTransactionModal } from './NanoContract/NewNanoContractTransactionModal';
import SignOracleDataModal from './NanoContract/SignOracleDataModal';
import CreateTokenModal from './CreateTokenModal';
import SendTransactionModal from './SendTransactionModal';
import InsufficientFundsModal from './InsufficientFundsModal';
import CreateNanoContractCreateTokenTxModal from './CreateNanoContractCreateTokenTxModal';
import GetBalanceModal from './GetBalanceModal';
import EnrichmentFailedModal from './EnrichmentFailedModal';

export default () => {
  const dispatch = useDispatch();
  const reownModal = useSelector((state) => state.reown.modal);

  if (!reownModal.show) {
    return null;
  }

  const onDismiss = () => {
    dispatch(hideReownModal());
  };

  const ModalComponent = {
    [ReownModalTypes.CONNECT]: ConnectModal,
    [ReownModalTypes.SIGN_MESSAGE]: SignMessageModal,
    [ReownModalTypes.SIGN_ORACLE_DATA]: SignOracleDataModal,
    [ReownModalTypes.SEND_NANO_CONTRACT_TX]: NewNanoContractTransactionModal,
    [ReownModalTypes.CREATE_TOKEN]: CreateTokenModal,
    [ReownModalTypes.SEND_TRANSACTION]: SendTransactionModal,
    [ReownModalTypes.INSUFFICIENT_FUNDS]: InsufficientFundsModal,
    [ReownModalTypes.ENRICHMENT_FAILED]: EnrichmentFailedModal,
    [ReownModalTypes.CREATE_NANO_CONTRACT_CREATE_TOKEN_TX]: CreateNanoContractCreateTokenTxModal,
    [ReownModalTypes.GET_BALANCE]: GetBalanceModal,
  };

  const getModal = (type) => {
    const Component = ModalComponent[type];
    if (!Component) {
      console.warn(`Tried to render modal ${type}, but it does not exist, ignoring.`);
      return null;
    }

    return (
      <Component {...reownModal} onDismiss={onDismiss} />
    );
  };

  return getModal(reownModal.type);
};

export const ReownModalTypes = {
  CONNECT: 'Connect',
  SIGN_MESSAGE: 'SignMessage',
  SIGN_ORACLE_DATA: 'SignOracleData',
  SEND_NANO_CONTRACT_TX: 'SendNanoContractTx',
  CREATE_TOKEN: 'CreateToken',
  SEND_TRANSACTION: 'SendTransaction',
  INSUFFICIENT_FUNDS: 'InsufficientFunds',
  CREATE_NANO_CONTRACT_CREATE_TOKEN_TX: 'CreateNanoContractCreateTokenTx',
  GET_BALANCE: 'GetBalance',
  ENRICHMENT_FAILED: 'EnrichmentFailed',
};
