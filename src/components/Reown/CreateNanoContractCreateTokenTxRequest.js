/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  firstAddressRequest,
  selectAddressAddressesRequest,
  reownAccept,
  reownReject,
} from '../../actions';
import {
  REOWN_NEW_NANOCONTRACT_TX_STATUS,
  NANOCONTRACT_BLUEPRINTINFO_STATUS,
  DEFAULT_TOKEN
} from '../../constants';
import { commonStyles } from './theme';

const styles = StyleSheet.create({
  wide: {
    flex: 1,
    width: '100%',
  },
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.lowContrastDetail,
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'stretch',
  },
  content: {
    flex: 1,
    rowGap: 24,
    width: '100%',
    paddingVertical: 16,
    alignItems: 'stretch',
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
  const addresses = useSelector((state) => state.selectAddressModal.addresses);

  const [ncAddress, setNcAddress] = useState('');
  const [showSelectAddressModal, setShowSelectAddressModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  // Create a memoized object with the caller address
  const nanoWithCaller = useMemo(() => ({
    ...nano,
    caller: ncAddress,
  }), [nano, ncAddress]);

  // Request first address and addresses for selection when component mounts
  useEffect(() => {
    // Request first address if not available
    if (!firstAddress.address && !firstAddress.error) {
      dispatch(firstAddressRequest());
    }
    // Request addresses for the address selection modal
    dispatch(selectAddressAddressesRequest());
  }, []);

  // Update ncAddress when firstAddress becomes available
  useEffect(() => {
    if (firstAddress.address && !ncAddress) {
      setNcAddress(firstAddress.address);
    }
  }, [firstAddress]);

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
    if (!ncAddress) {
      console.warn('No address selected, cannot submit transaction');
      return;
    }

    dispatch(setNewNanoContractStatusLoading());

    // Create combined payload with nano contract and token data
    const acceptedData = {
      nano: nanoWithCaller,
      token,
      address: ncAddress,
    };

    if (typeof onAccept === 'function') {
      onAccept(acceptedData);
    } else {
      // If callback is not provided, use the standard action
      dispatch(reownAccept(acceptedData));
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

    // Following the pattern in NewNanoContractTransactionRequest
    // Dispatch reownReject action first, then call onReject callback if available
    dispatch(reownReject());

    if (typeof onReject === 'function') {
      onReject();
    }

    navigateBack();
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
  const isTxInfoLoading = () => (
    knownTokens.isLoading
    || blueprintInfo == null
    || blueprintInfo?.status === NANOCONTRACT_BLUEPRINTINFO_STATUS.LOADING
  );

  const isTxReady = () => !isTxInfoLoading()
    && newTxStatus !== REOWN_NEW_NANOCONTRACT_TX_STATUS.LOADING;
  const isTxProcessing = () => !isTxInfoLoading()
    && newTxStatus === REOWN_NEW_NANOCONTRACT_TX_STATUS.LOADING;
  const isTxSuccessful = () => newTxStatus === REOWN_NEW_NANOCONTRACT_TX_STATUS.SUCCESSFUL;
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

  return (
    <>
      <ScrollView style={styles.wide}>
        <View style={styles.wrapper}>
          <View style={styles.content}>
            <DappContainer dapp={dapp} />
            <NanoContractExecInfo
              nc={nanoWithCaller}
              onSelectAddress={toggleSelectAddressModal}
            />
            <NanoContractActions
              ncActions={nano.actions}
              tokens={knownTokens}
              error={knownTokens.error}
            />
            <NanoContractMethodArgs
              blueprintId={nano.blueprintId}
              blueprintName={blueprintInfo?.data?.name}
              method={nano.method}
              ncArgs={nano.args}
            />

            <View style={{ width: '100%', alignSelf: 'stretch' }}>
              <Text style={[commonStyles.sectionTitle, { marginBottom: 0 }]}>{t`Create Token Data`}</Text>
            </View>

            <View style={{ width: '100%', alignSelf: 'stretch' }}>
              <CreateTokenRequestData data={token} />
            </View>

            <View style={styles.actionContainer}>
              <NewHathorButton
                title={t`Accept Request`}
                onPress={onAcceptTransaction}
                disabled={!ncAddress}
              />
              <NewHathorButton
                title={t`Decline Request`}
                onPress={onDeclineTransaction}
                secondary
                danger
              />
            </View>
          </View>
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

      {isTxSuccessful() && (
        <FeedbackModal
          icon={(<Image source={checkIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
          text={t`Transaction successfully sent.`}
          onDismiss={onFeedbackModalDismiss}
          action={(<NewHathorButton discrete title={t`Ok, close`} onPress={onNavigateToDashboard} />)}
        />
      )}

      {isTxFailed() && (
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

export default CreateNanoContractCreateTokenTxRequest;
