/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import { View, Text } from 'react-native';
import { BaseNanoContractRequest } from './NanoContract/BaseNanoContractRequest';
import { CreateTokenRequestData } from './CreateTokenRequest';
import {
  setCreateNanoContractCreateTokenTxStatusLoading,
  setCreateNanoContractCreateTokenTxStatusReady,
  createNanoContractCreateTokenTxRetry,
  createNanoContractCreateTokenTxRetryDismiss,
} from '../../actions';
import {
  REOWN_CREATE_NANO_CONTRACT_CREATE_TOKEN_TX_STATUS,
} from '../../constants';
import { commonStyles } from './theme';

export const CreateNanoContractCreateTokenTxRequest = ({ route }) => {
  const { createNanoContractCreateTokenTxRequest: request, onAccept, onReject } = route.params;
  const { data, dapp } = request;
  const { nano, token } = data;

  // Status configuration for the base component
  const statusConfig = {
    statusSelector: 'reown.createNanoContractCreateTokenTx.status',
    statusConstants: REOWN_CREATE_NANO_CONTRACT_CREATE_TOKEN_TX_STATUS,
    setLoadingAction: setCreateNanoContractCreateTokenTxStatusLoading,
    setReadyAction: setCreateNanoContractCreateTokenTxStatusReady,
    retryAction: createNanoContractCreateTokenTxRetry,
    retryDismissAction: createNanoContractCreateTokenTxRetryDismiss,
  };

  // Function to prepare the accept data with both nano and token data
  const prepareAcceptData = (nanoWithCaller, ncAddress) => ({
    nano: nanoWithCaller,
    token,
    address: ncAddress,
  });

  // Function to render the additional token creation content
  const renderAdditionalContent = () => (
    <>
      <View style={{ width: '100%', alignSelf: 'stretch' }}>
        <Text style={[commonStyles.sectionTitle, { marginBottom: 0 }]}>
          {t`Create Token Data`}
        </Text>
      </View>

      <View style={{ width: '100%', alignSelf: 'stretch' }}>
        <CreateTokenRequestData data={token} />
      </View>
    </>
  );

  return (
    <BaseNanoContractRequest
      nano={nano}
      dapp={dapp}
      onAccept={onAccept}
      onReject={onReject}
      statusConfig={statusConfig}
      renderAdditionalContent={renderAdditionalContent}
      prepareAcceptData={prepareAcceptData}
      acceptButtonText={t`Accept Request`}
      declineButtonText={t`Decline Request`}
      checkInsufficientBalance
    />
  );
};

export default CreateNanoContractCreateTokenTxRequest;
