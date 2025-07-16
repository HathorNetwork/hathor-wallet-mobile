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
import { COLORS } from '../../../styles/themes';
import NewHathorButton from '../../NewHathorButton';
import { DappContainer } from './DappContainer';
import { NanoContractExecInfo } from './NanoContractExecInfo';
import { NanoContractActions } from './NanoContractActions';
import { NanoContractMethodArgs } from './NanoContractMethodArgs';
import { FeedbackContent } from '../../FeedbackContent';
import FeedbackModal from '../../FeedbackModal';
import Spinner from '../../Spinner';
import { SelectAddressModal } from '../../NanoContract/SelectAddressModal';
import { DeclineModal } from './DeclineModal';
import { useBackButtonHandler } from '../../../hooks/useBackButtonHandler';
import errorIcon from '../../../assets/images/icErrorBig.png';
import {
  nanoContractBlueprintInfoRequest,
  unregisteredTokensDownloadRequest,
  firstAddressRequest,
  selectAddressAddressesRequest,
  reownAccept,
  reownReject,
  nanoContractRegisterRequest,
  nanoContractRegisterReady,
} from '../../../actions';
import {
  NANOCONTRACT_BLUEPRINTINFO_STATUS,
  NANOCONTRACT_REGISTER_STATUS,
  DEFAULT_TOKEN
} from '../../../constants';

const styles = StyleSheet.create({
  wide: {
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
    flexDirection: 'column',
    gap: 8,
    paddingTop: 32,
  },
  feedbackModalIcon: {
    height: 105,
    width: 105,
  },
  warningContainer: {
    backgroundColor: '#F2C3BE',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningIcon: {
    color: '#991300',
    marginRight: 8,
    fontSize: 16,
  },
  warningText: {
    color: '#000000',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  warningTextBold: {
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#E5E5E5',
  },
  disabledButtonText: {
    color: '#737373',
  },
});

/**
 * Base component for nano contract requests that provides common functionality
 *
 * @param {Object} props
 * @param {Object} props.nano - Nano contract data
 * @param {Object} props.dapp - DApp information
 * @param {Function} props.onAccept - Accept callback
 * @param {Function} props.onReject - Reject callback
 * @param {Object} props.statusConfig - Status configuration object
 * @param {string} props.statusConfig.statusSelector - Redux selector path for status
 * @param {Object} props.statusConfig.statusConstants - Status constants object
 * @param {Function} props.statusConfig.setLoadingAction - Action to set loading status
 * @param {Function} props.statusConfig.setReadyAction - Action to set ready status
 * @param {Function} props.statusConfig.retryAction - Action to retry
 * @param {Function} props.statusConfig.retryDismissAction - Action to dismiss retry
 * @param {Function} props.renderAdditionalContent - Function to render additional content
 * @param {Function} props.prepareAcceptData - Function to prepare data for accept action
 * @param {string} props.acceptButtonText - Text for accept button
 * @param {string} props.declineButtonText - Text for decline button
 * @param {boolean} props.checkInsufficientBalance - Whether to check for insufficient balance
 */
export const BaseNanoContractRequest = ({
  nano,
  dapp,
  onAccept,
  onReject,
  statusConfig,
  renderAdditionalContent,
  prepareAcceptData,
  acceptButtonText = t`Accept Transaction`,
  declineButtonText = t`Decline Transaction`,
  checkInsufficientBalance = false,
}) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  // Get status from redux using the provided selector path
  const status = useSelector((state) => {
    const parts = statusConfig.statusSelector.split('.');
    let result = state;
    for (const part of parts) {
      result = result?.[part];
    }
    return result;
  });

  const firstAddress = useSelector((state) => state.firstAddress);
  const knownTokens = useSelector((state) => ({ ...state.tokens, ...state.unregisteredTokens }));
  const blueprintInfo = useSelector((state) => state.nanoContract.blueprint[nano.blueprintId]);
  const tokensBalance = useSelector((state) => state.tokensBalance);

  // Nano contract registration state
  const registeredNc = useSelector((state) => state.nanoContract.registered[nano.ncId]);
  const registerStatus = useSelector((state) => state.nanoContract.registerStatus);
  const isNcRegistering = registerStatus === NANOCONTRACT_REGISTER_STATUS.LOADING;
  const hasNcRegisterFailed = registerStatus === NANOCONTRACT_REGISTER_STATUS.FAILED;

  const [ncAddress, setNcAddress] = useState(registeredNc?.address || firstAddress.address);
  const [showSelectAddressModal, setShowSelectAddressModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  // Create a memoized object with the caller address
  const nanoWithCaller = useMemo(() => ({
    ...nano,
    caller: ncAddress,
  }), [nano, ncAddress]);

  // Check if nano contract is not registered and method is not 'initialize'
  const notInitialize = nanoWithCaller.method !== 'initialize';
  const notRegistered = useMemo(() => (
    notInitialize && registeredNc == null
  ), [notInitialize, registeredNc]);
  const showRequest = !notRegistered;

  // Check if we have enough balance for deposit actions
  const hasInsufficientBalance = useMemo(() => {
    if (!checkInsufficientBalance || !nano.actions) return false;

    // Track running balance per token
    const tokenBalances = {};

    for (const { type, token, amount } of nano.actions) {
      if (type === 'deposit') {
        // Initialize token balance if first time seeing this token
        if (!(token in tokenBalances)) {
          const balance = tokensBalance[token]?.data?.available || 0n;
          tokenBalances[token] = balance;
        }

        tokenBalances[token] -= amount;

        if (tokenBalances[token] < 0n) {
          // Early exit if we go negative
          return true;
        }
      }
    }

    return false;
  }, [checkInsufficientBalance, nano.actions, tokensBalance]);

  // Request first address and addresses for selection when component mounts
  useEffect(() => {
    if (!firstAddress.address && !firstAddress.error) {
      dispatch(firstAddressRequest());
    }
    dispatch(selectAddressAddressesRequest());
  }, []);

  // Update ncAddress when firstAddress becomes available
  useEffect(() => {
    if (firstAddress.address && !ncAddress) {
      setNcAddress(firstAddress.address);
    }

    if (notRegistered && !isNcRegistering && !firstAddress.address && !firstAddress.error) {
      dispatch(firstAddressRequest());
    }
  }, [firstAddress, notRegistered, isNcRegistering]);

  // When nano contract is registered it should set the caller address
  useEffect(() => {
    if (!ncAddress && registeredNc?.address) {
      setNcAddress(registeredNc.address);
    }
  }, [registeredNc, ncAddress]);

  // Handle successful transaction navigation
  useEffect(() => {
    if (status === statusConfig.statusConstants.SUCCESSFUL) {
      navigation.navigate(
        'SuccessFeedbackScreen',
        {
          title: t`Success!`,
          message: t`Transaction successfully sent.`,
        }
      );
      dispatch(statusConfig.setReadyAction());
    }
  }, [status]);

  // Request blueprint info and token data when component mounts
  useEffect(() => {
    // This component should always start with ready state
    dispatch(statusConfig.setReadyAction());

    // Do nothing if nano contract is not registered and don't call initialize method
    if (notRegistered) return undefined;

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

    // Clean up function
    return () => {
      // Restore ready status to Nano Contract registration state if
      // we have had a registration while handling a new transaction request
      dispatch(nanoContractRegisterReady());
      dispatch(statusConfig.setReadyAction());
      // Dismiss the retry condition to New Nano Contract Transaction
      dispatch(statusConfig.retryDismissAction());
      // If the user leaves without accepting or declining, we should decline the transaction
      if (status !== statusConfig.statusConstants.SUCCESSFUL) {
        dispatch(reownReject());
      }
    };
  }, [notRegistered]);

  const toggleSelectAddressModal = () => {
    setShowSelectAddressModal(!showSelectAddressModal);
  };

  const handleAddressSelection = ({ address }) => {
    setNcAddress(address);
    toggleSelectAddressModal();
  };

  const onAcceptTransaction = () => {
    if (!ncAddress) {
      console.warn('No address selected, cannot submit transaction');
      return;
    }

    dispatch(statusConfig.setLoadingAction());

    const acceptedData = prepareAcceptData
      ? prepareAcceptData(nanoWithCaller, ncAddress)
      : nanoWithCaller;

    if (typeof onAccept === 'function') {
      onAccept(acceptedData);
    } else {
      dispatch(reownAccept(acceptedData));
    }
  };

  const onRegisterNanoContract = () => {
    dispatch(nanoContractRegisterRequest({
      address: firstAddress.address,
      ncId: nanoWithCaller.ncId
    }));
  };

  const onDeclineTransaction = () => {
    setShowDeclineModal(true);
  };

  const { navigateBack } = useBackButtonHandler(
    onDeclineTransaction,
    status === statusConfig.statusConstants.SUCCESSFUL
  );

  const onDeclineConfirmation = () => {
    setShowDeclineModal(false);
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
    dispatch(statusConfig.retryDismissAction());
    navigateBack();
  };

  const onTryAgain = () => {
    dispatch(statusConfig.setReadyAction());
    dispatch(statusConfig.retryAction());
  };

  // Loading states
  const isTxInfoLoading = () => (
    knownTokens.isLoading
    || blueprintInfo == null
    || blueprintInfo?.status === NANOCONTRACT_BLUEPRINTINFO_STATUS.LOADING
  );

  const isTxInfoLoaded = () => (
    !isTxInfoLoading() && status !== statusConfig.statusConstants.LOADING
  );

  const isTxProcessing = () => !isTxInfoLoading()
    && status === statusConfig.statusConstants.LOADING;

  const isTxFailed = () => status === statusConfig.statusConstants.FAILED;

  // Handle nano contract not registered state
  if (notRegistered && isNcRegistering) {
    return (
      <>
        <FeedbackContent
          title={t`Loading`}
          message={t`Registering Nano Contract.`}
          icon={<Spinner size={48} animating />}
          offmargin
          offcard
          offbackground
        />
        <DeclineModal
          show={showDeclineModal}
          onDecline={onDeclineConfirmation}
          onDismiss={onDismissDeclineModal}
        />
      </>
    );
  }

  if (notRegistered && !isNcRegistering) {
    return (
      <>
        <FeedbackContent
          title={t`Nano Contract Not Found`}
          message={t`The Nano Contract requested is not registered. First register the Nano Contract to interact with it.`}
          action={(
            <View style={styles.feedbackActionContainer}>
              {/* Doesn't show up if an error happens in first address request */}
              {!firstAddress.error && (
                <NewHathorButton
                  title={t`Register Nano Contract`}
                  onPress={onRegisterNanoContract}
                />
              )}
              <NewHathorButton
                title={t`Decline Transaction`}
                onPress={onDeclineTransaction}
                secondary
                danger
              />
            </View>
          )}
        />
        <DeclineModal
          show={showDeclineModal}
          onDecline={onDeclineConfirmation}
          onDismiss={onDismissDeclineModal}
        />
      </>
    );
  }

  if (notRegistered && hasNcRegisterFailed) {
    return (
      <>
        <FeedbackModal
          icon={(<Image source={errorIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
          text={t`Error while registering Nano Contract.`}
          onDismiss={onDeclineConfirmation}
          action={(<NewHathorButton discrete title={t`Decline Transaction`} onPress={onDeclineConfirmation} />)}
        />
        <DeclineModal
          show={showDeclineModal}
          onDecline={onDeclineConfirmation}
          onDismiss={onDismissDeclineModal}
        />
      </>
    );
  }

  if (showRequest && isTxInfoLoading()) {
    return (
      <>
        <FeedbackContent
          title={t`Loading`}
          message={t`Loading transaction information.`}
          icon={<Spinner size={48} animating />}
          offmargin
          offcard
          offbackground
        />
        <DeclineModal
          show={showDeclineModal}
          onDecline={onDeclineConfirmation}
          onDismiss={onDismissDeclineModal}
        />
      </>
    );
  }

  if (showRequest && isTxProcessing()) {
    return (
      <>
        <FeedbackContent
          title={t`Sending transaction`}
          message={t`Please wait.`}
          icon={<Spinner size={48} animating />}
          offmargin
          offcard
          offbackground
        />
        <DeclineModal
          show={showDeclineModal}
          onDecline={onDeclineConfirmation}
          onDismiss={onDismissDeclineModal}
        />
      </>
    );
  }

  if (!showRequest || !isTxInfoLoaded()) {
    return null;
  }

  return (
    <>
      <ScrollView
        style={styles.wide}
        automaticallyAdjustsScrollIndicatorInsets={false}
        contentInsetAdjustmentBehavior='never'
      >
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

            {renderAdditionalContent && renderAdditionalContent()}

            <View style={styles.actionContainer}>
              {hasInsufficientBalance && (
                <View style={styles.warningContainer}>
                  <Text style={styles.warningIcon}>⚠</Text>
                  <Text style={styles.warningText}>
                    <Text style={styles.warningTextBold}>{t`Insufficient Funds`}. </Text>
                    {t`Ensure your wallet balance covers the required amount to accept this transaction.`}
                  </Text>
                </View>
              )}
              <NewHathorButton
                title={acceptButtonText}
                onPress={onAcceptTransaction}
                disabled={!ncAddress || hasInsufficientBalance}
                style={hasInsufficientBalance && styles.disabledButton}
                textStyle={hasInsufficientBalance && styles.disabledButtonText}
              />
              <NewHathorButton
                title={declineButtonText}
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
        onEditAddress={handleAddressSelection}
        onDismiss={toggleSelectAddressModal}
      />

      <DeclineModal
        show={showDeclineModal}
        onDecline={onDeclineConfirmation}
        onDismiss={onDismissDeclineModal}
      />

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

export default BaseNanoContractRequest;
