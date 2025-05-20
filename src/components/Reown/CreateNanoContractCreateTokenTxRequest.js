/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../styles/themes';
import NewHathorButton from '../NewHathorButton';
import { DappContainer } from './NanoContract/DappContainer';
import { NanoContractExecInfo } from './NanoContract/NanoContractExecInfo';
import { NanoContractActions } from './NanoContract/NanoContractActions';
import { NanoContractMethodArgs } from './NanoContract/NanoContractMethodArgs';
import { CreateTokenRequestData } from './CreateTokenRequest';
import { FeedbackContent } from '../FeedbackContent';
import FeedbackModal from '../FeedbackModal';
import Spinner from '../Spinner';
import { SelectAddressModal } from '../NanoContract/SelectAddressModal';
import { DeclineModal } from './NanoContract/DeclineModal';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import errorIcon from '../../assets/images/icErrorBig.png';
import checkIcon from '../../assets/images/icCheckBig.png';
import {
  setNewNanoContractStatusLoading,
  setNewNanoContractStatusReady,
  nanoContractBlueprintInfoRequest,
  unregisteredTokensDownloadRequest,
  newNanoContractRetry,
  newNanoContractRetryDismiss,
} from '../../actions';
import {
  REOWN_NEW_NANOCONTRACT_TX_STATUS,
  NANOCONTRACT_BLUEPRINTINFO_STATUS,
  DEFAULT_TOKEN
} from '../../constants';

const styles = StyleSheet.create({
  wide: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.lowContrastDetail,
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
    rowGap: 24,
    width: '100%',
    paddingVertical: 16,
  },
  actionContainer: {
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 48,
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
  feedbackModalIcon: {
    height: 36,
    width: 36,
  },
});

export const CreateNanoContractCreateTokenTxRequest = ({ route }) => {
  const { createNanoContractCreateTokenTxRequest: request, onAccept, onReject } = route.params;
  const { data, dapp } = request;
  const { nano, token } = data;

  const dispatch = useDispatch();
  const navigation = useNavigation();
  const newTxStatus = useSelector((state) => state.reown.newNanoContractTransaction.status);
  const firstAddress = useSelector((state) => state.firstAddress);
  const knownTokens = useSelector((state) => ({ ...state.tokens, ...state.unregisteredTokens }));
  const blueprintInfo = useSelector((state) => state.nanoContract.blueprint[nano.blueprintId]);

  const [ncAddress, setNcAddress] = useState(firstAddress.address);
  const [showSelectAddressModal, setShowSelectAddressModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  // Request blueprint info and token data when component mounts
  useEffect(() => {
    // Request blueprint info if not present
    if (!blueprintInfo) {
      dispatch(nanoContractBlueprintInfoRequest(nano.blueprintId));
    }

    // Request token data for each unknown token present in actions
    const unknownTokensUid = [];
    const actionTokensUid = nano.actions?.map((each) => each.token) || [];
    actionTokensUid.forEach((uid) => {
      if (uid !== DEFAULT_TOKEN.uid && !(uid in knownTokens)) {
        unknownTokensUid.push(uid);
      }
    });

    if (unknownTokensUid.length > 0) {
      dispatch(unregisteredTokensDownloadRequest({ uids: unknownTokensUid }));
    }

    // Clean up function to ensure everything is reset when component unmounts
    return () => {
      dispatch(setNewNanoContractStatusReady());
    };
  }, []);

  const toggleSelectAddressModal = () => {
    setShowSelectAddressModal(!showSelectAddressModal);
  };

  const handleAddressSelection = (newAddress) => {
    setNcAddress(newAddress);
    toggleSelectAddressModal();
  };

  const onAcceptTransaction = () => {
    dispatch(setNewNanoContractStatusLoading());
    if (typeof onAccept === 'function') {
      onAccept({ nano, token, address: ncAddress });
    } else {
      // If onAccept is not provided, just show a success state and navigate back
      console.warn('onAccept is undefined, cannot submit transaction');
      navigation.goBack();
    }
  };

  const onDeclineTransaction = () => {
    setShowDeclineModal(true);
  };

  const { navigateBack } = useBackButtonHandler(
    onDeclineTransaction,
    newTxStatus === REOWN_NEW_NANOCONTRACT_TX_STATUS.SUCCESSFUL
  );

  const onDeclineConfirmation = () => {
    setShowDeclineModal(false);
    if (typeof onReject === 'function') {
      onReject();
    } else {
      // If onReject is not provided, just navigate back
      navigation.goBack();
    }
  };

  const onDismissDeclineModal = () => {
    setShowDeclineModal(false);
  };

  const onFeedbackModalDismiss = () => {
    dispatch(newNanoContractRetryDismiss());
    navigateBack();
  };

  const onNavigateToDashboard = () => {
    navigation.navigate('Dashboard');
  };

  const onTryAgain = () => {
    dispatch(newNanoContractRetry());
  };

  // Loading states
  const isTxInfoLoading = () => {
    console.log('Debug loading state:', {
      tokens_loading: knownTokens.isLoading,
      blueprint_null: blueprintInfo == null,
      blueprint_status: blueprintInfo?.status,
      blueprint_id: nano.blueprintId,
    });

    return (
      knownTokens.isLoading
      || blueprintInfo == null
      || blueprintInfo?.status === NANOCONTRACT_BLUEPRINTINFO_STATUS.LOADING
    );
  };

  const isTxReady = !isTxInfoLoading()
    && newTxStatus !== REOWN_NEW_NANOCONTRACT_TX_STATUS.LOADING;
  const isTxProcessing = !isTxInfoLoading()
    && newTxStatus === REOWN_NEW_NANOCONTRACT_TX_STATUS.LOADING;
  const isTxSuccessful = newTxStatus === REOWN_NEW_NANOCONTRACT_TX_STATUS.SUCCESSFUL;
  const isTxFailed = newTxStatus === REOWN_NEW_NANOCONTRACT_TX_STATUS.FAILED;

  return (
    <>
      <ScrollView style={styles.wide}>
        <View style={styles.wrapper}>
          {isTxReady && (
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
              <CreateTokenRequestData data={token} />
              <View style={styles.actionContainer}>
                <NewHathorButton
                  title={t`Accept Request`}
                  onPress={onAcceptTransaction}
                />
                <NewHathorButton
                  title={t`Decline Request`}
                  onPress={onDeclineTransaction}
                  secondary
                  danger
                />
              </View>
            </View>
          )}
          {isTxProcessing && (
            <FeedbackContent
              title={t`Sending transaction`}
              message={t`Please wait.`}
              icon={<Spinner size={48} animating />}
              offmargin
              offcard
              offbackground
            />
          )}
        </View>
      </ScrollView>

      <SelectAddressModal
        address={ncAddress}
        show={showSelectAddressModal}
        onSelectAddress={handleAddressSelection}
        onDismiss={toggleSelectAddressModal}
      />

      <DeclineModal
        show={showDeclineModal}
        onDecline={onDeclineConfirmation}
        onDismiss={onDismissDeclineModal}
      />

      {isTxSuccessful && (
        <FeedbackModal
          icon={(<Image source={checkIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
          text={t`Transaction successfully sent.`}
          onDismiss={onFeedbackModalDismiss}
          action={(<NewHathorButton discrete title={t`Ok, close`} onPress={onNavigateToDashboard} />)}
        />
      )}

      {isTxFailed && (
        <FeedbackModal
          icon={(<Image source={errorIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
          text={t`Error while sending transaction.`}
          onDismiss={onFeedbackModalDismiss}
          action={(<NewHathorButton discrete title={t`Try again`} onPress={onTryAgain} />)}
        />
      )}
    </>
  );
};