/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import { BaseNanoContractRequest } from './BaseNanoContractRequest';
import {
  setNewNanoContractStatusReady,
  setNewNanoContractStatusLoading,
  newNanoContractRetry,
  newNanoContractRetryDismiss,
} from '../../../actions';
import { REOWN_NEW_NANOCONTRACT_TX_STATUS } from '../../../constants';

/**
 * @param {Object} props
 * @param {Object} props.ncTxRequest
 * @param {Object} props.ncTxRequest.nc
 * @param {string} props.ncTxRequest.nc.ncId
 * @param {string} props.ncTxRequest.nc.blueprintId
 * @param {Object[]} props.ncTxRequest.nc.actions
 * @param {string} props.ncTxRequest.nc.method
 * @param {string[]} props.ncTxRequest.nc.args
 * @param {Object} props.ncTxRequest.dapp
 * @param {string} props.ncTxRequest.dapp.icon
 * @param {string} props.ncTxRequest.dapp.proposer
 * @param {string} props.ncTxRequest.dapp.url
 * @param {string} props.ncTxRequest.dapp.description
 */
export const NewNanoContractTransactionRequest = ({ ncTxRequest }) => {
  const { data: nc, dapp } = ncTxRequest;

  // Status configuration for the base component
  const statusConfig = {
    statusSelector: 'reown.newNanoContractTransaction.status',
    statusConstants: REOWN_NEW_NANOCONTRACT_TX_STATUS,
    setLoadingAction: setNewNanoContractStatusLoading,
    setReadyAction: setNewNanoContractStatusReady,
    retryAction: newNanoContractRetry,
    retryDismissAction: newNanoContractRetryDismiss,
  };

  return (
    <BaseNanoContractRequest
      nano={nc}
      dapp={dapp}
      statusConfig={statusConfig}
      acceptButtonText={t`Accept Transaction`}
      declineButtonText={t`Decline Transaction`}
      checkInsufficientBalance
    />
  );
};

export default NewNanoContractTransactionRequest;
