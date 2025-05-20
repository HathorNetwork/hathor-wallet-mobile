/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../../styles/themes';
import NewHathorButton from '../NewHathorButton';
import { DappContainer } from './NanoContract/DappContainer';
import { NanoContractExecInfo } from './NanoContract/NanoContractExecInfo';
import { NanoContractActions } from './NanoContract/NanoContractActions';
import { NanoContractMethodArgs } from './NanoContract/NanoContractMethodArgs';
import { CreateTokenRequest } from './CreateTokenRequest';
import FeedbackContent from '../FeedbackContent';
import Spinner from '../Spinner';
import { setNewNanoContractStatusLoading, setNewNanoContractStatusReady, setNewNanoContractStatusSuccess, setNewNanoContractStatusFailure } from '../../actions';
import { REOWN_NEW_NANOCONTRACT_TX_STATUS, NANOCONTRACT_BLUEPRINTINFO_STATUS } from '../../constants';

const styles = StyleSheet.create({
  wide: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  content: {
    padding: 16,
  },
  actionContainer: {
    marginTop: 24,
    gap: 12,
  },
  feedbackActionContainer: {
    marginTop: 24,
    gap: 12,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningBackground,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.warningText,
  },
  warningTextBold: {
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    color: COLORS.textColor,
  },
});

export const CreateNanoContractCreateTokenTxRequest = ({ route }) => {
  const { createNanoContractCreateTokenTxRequest: request } = route.params;
  const { data, dapp, onAccept, onReject } = request;
  const { nano, token } = data;

  const dispatch = useDispatch();
  const newTxStatus = useSelector((state) => state.reown.newNanoContractTransaction.status);
  const firstAddress = useSelector((state) => state.firstAddress);
  const knownTokens = useSelector((state) => ({ ...state.tokens, ...state.unregisteredTokens }));
  const blueprintInfo = useSelector((state) => state.nanoContract.blueprint[nano.blueprintId]);

  const [ncAddress, setNcAddress] = useState(firstAddress.address);
  const [showSelectAddressModal, setShowSelectAddressModal] = useState(false);

  const toggleSelectAddressModal = () => {
    setShowSelectAddressModal(!showSelectAddressModal);
  };

  const onAcceptTransaction = () => {
    dispatch(setNewNanoContractStatusLoading());
    onAccept({ nano, token, address: ncAddress });
  };

  const onDeclineTransaction = () => {
    onReject();
  };

  // Loading while downloading:
  // 1. each token details
  // 2. the blueprint details
  const isTxInfoLoading = () => (
    knownTokens.isLoading
    || blueprintInfo == null
    || blueprintInfo?.status === NANOCONTRACT_BLUEPRINTINFO_STATUS.LOADING
  );
  const isTxInfoLoaded = () => (
    !isTxInfoLoading() && newTxStatus !== REOWN_NEW_NANOCONTRACT_TX_STATUS.LOADING
  );
  const isTxProcessing = () => (
    !isTxInfoLoading() && newTxStatus === REOWN_NEW_NANOCONTRACT_TX_STATUS.LOADING
  );
  const isTxFailed = () => newTxStatus === REOWN_NEW_NANOCONTRACT_TX_STATUS.FAILED;

  if (isTxInfoLoading()) {
    return (
      <FeedbackContent
        title={t`Loading`}
        message={t`Loading transaction details.`}
        icon={<Spinner size={48} animating />}
        offmargin
        offcard
        offbackground
      />
    );
  }

  if (isTxProcessing()) {
    return (
      <FeedbackContent
        title={t`Sending transaction`}
        message={t`Please wait.`}
        icon={<Spinner size={48} animating />}
        offmargin
        offcard
        offbackground
      />
    );
  }

  if (isTxFailed()) {
    return (
      <FeedbackContent
        title={t`Transaction Failed`}
        message={t`The transaction could not be sent. Please try again.`}
        action={(
          <View style={styles.feedbackActionContainer}>
            <NewHathorButton
              title={t`Try Again`}
              onPress={onAcceptTransaction}
            />
            <NewHathorButton
              title={t`Decline Transaction`}
              onPress={onDeclineTransaction}
              secondary
              danger
            />
          </View>
        )}
      />
    );
  }

  return (
    <ScrollView style={styles.wide}>
      <View style={styles.wrapper}>
        <View style={styles.content}>
          <DappContainer dapp={dapp} />
          <NanoContractExecInfo
            nc={nano}
            onSelectAddress={toggleSelectAddressModal}
          />
          <NanoContractActions
            ncActions={nano.actions}
            tokens={knownTokens}
            error={knownTokens.error}
          />
          <NanoContractMethodArgs
            blueprintId={nano.blueprintId}
            method={nano.method}
            ncArgs={nano.args}
          />
          <CreateTokenRequest
            data={token}
            onAccept={onAcceptTransaction}
            onReject={onDeclineTransaction}
          />
        </View>
      </View>
    </ScrollView>
  );
};