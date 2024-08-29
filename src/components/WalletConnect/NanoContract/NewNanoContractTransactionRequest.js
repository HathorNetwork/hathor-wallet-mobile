/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, {
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableWithoutFeedback,
  Image
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { t } from 'ttag';
import {
  nanoContractBlueprintInfoRequest,
  newNanoContractRetry,
  newNanoContractRetryDismiss,
  setNewNanoContractStatusReady,
  walletConnectAccept,
  walletConnectReject,
  unregisteredTokensRequest
} from '../../../actions';
import { COLORS } from '../../../styles/themes';
import NewHathorButton from '../../NewHathorButton';
import { SelectAddressModal } from '../../NanoContract/SelectAddressModal';
import { FeedbackContent } from '../../FeedbackContent';
import { DEFAULT_TOKEN, NANOCONTRACT_BLUEPRINTINFO_STATUS, WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS } from '../../../constants';
import Spinner from '../../Spinner';
import FeedbackModal from '../../FeedbackModal';
import errorIcon from '../../../assets/images/icErrorBig.png';
import checkIcon from '../../../assets/images/icCheckBig.png';
import { DappContainer } from './DappContainer';
import { NanoContractExecInfo } from './NanoContractExecInfo';
import { NanoContractActions } from './NanoContractActions';
import { NanoContractMethodArgs } from './NanoContractMethodArgs';
import { DeclineModal } from './DeclineModal';

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
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const newTxStatus = useSelector((state) => state.walletConnect.newNanoContractTransaction.status);
  const firstAddress = useSelector((state) => state.firstAddress);
  // Nullable if the nano contract method is 'initialize'
  const registeredNc = useSelector((state) => state.nanoContract.registered[nc.ncId]);
  const knownTokens = useSelector((state) => ({ ...state.tokens, ...state.unregisteredTokens }));
  const blueprintInfo = useSelector((state) => state.nanoContract.blueprint[nc.blueprintId]);

  const [showSelectAddressModal, setShowSelectAddressModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  /**
   * If nano-contract's method is 'initialize' then the expression
   * should be resolved to firstAddress value by default.
   *
   * In case of failure to load the first address the user will see
   * a feedback message instruction it to select an address for the
   * transaction.
   */
  const [ncAddress, setNcAddress] = useState(registeredNc?.address || firstAddress.address);
  const ncToAccept = useMemo(() => ({
    ...nc,
    caller: ncAddress,
  }), [ncAddress])

  const toggleSelectAddressModal = () => setShowSelectAddressModal(!showSelectAddressModal);
  const handleAddressSelection = (newAddress) => {
    setNcAddress(newAddress);
    toggleSelectAddressModal();
  };

  // Accepts the Nano Contract data preseted.
  const onAcceptTransaction = () => {
    // Update the caller with the address selected by the user.
    const acceptedNc = { ...nc, caller: ncAddress };
    // Signal the user has accepted the current request and pass the accepted data.
    dispatch(walletConnectAccept(acceptedNc));
  };

  const onDeclineTransaction = () => {
    setShowDeclineModal(true);
  };
  const onDeclineConfirmation = () => {
    setShowDeclineModal(false);
    dispatch(walletConnectReject());
    navigation.goBack();
  };
  const onDismissDeclineModal = () => {
    setShowDeclineModal(false);
  };

  // Control which content to show, if the nano contract is not registered
  // a feedback content should tell user the nano contract must be registered first
  // and only let user decline the transaction to get out the page, otherwise interaction
  // content is showed.
  const notInitialize = ncToAccept.method !== 'initialize';
  const notRegistered = notInitialize && registeredNc == null;
  // It results in true for registered nc and initialize request
  const showRequest = !notRegistered;

  // This effect should run at most twice:
  // 1. when in the construct phase
  // 2. after firstAddress is set on store after a request to load it
  // The mentioned load request at (2) can happen for 'initialize' transaction,
  // it is requested from a child component, NanoContractExecInfo.
  useEffect(() => {
    if (ncToAccept.method === 'initialize' && firstAddress.address) {
      setNcAddress(firstAddress.address);
    }
  }, [firstAddress]);

  // This effect runs only once in the construct phase
  useEffect(() => {
    // Do nothing if nano contract is not registered and don't call initialize method.
    if (notRegistered) return undefined;

    // Request blueprint info if not present to feed the components:
    // - NanoContractExecInfo, and
    // - NanoContractMethodArgs
    if (!blueprintInfo) {
      dispatch(nanoContractBlueprintInfoRequest(nc.blueprintId));
    }

    // Request token data for each unknown token present in actions
    const unknownTokensUid = [];
    const actionTokensUid = nc.actions?.map((each) => each.token) || [];
    actionTokensUid.forEach((uid) => {
      if (uid !== DEFAULT_TOKEN.uid && !(uid in knownTokens)) {
        unknownTokensUid.push(uid);
      }
    });
    dispatch(unregisteredTokensRequest({ uids: unknownTokensUid }));

    return () => {
      dispatch(setNewNanoContractStatusReady());
      dispatch(newNanoContractRetryDismiss());
    };
  }, []);

  const onFeedbackModalDismiss = () => {
    navigation.goBack();
  };

  const onNavigateToDashboard = () => {
    navigation.navigate('Dashboard');
  };

  const onTryAgain = () => {
    dispatch(setNewNanoContractStatusReady());
    dispatch(newNanoContractRetry());
  };

  // Loading while downloading:
  // 1. each token details
  // 2. the blueprint details
  const isTxInfoLoading = () => (
    knownTokens.isLoading
    || blueprintInfo == null
    || blueprintInfo.status === NANOCONTRACT_BLUEPRINTINFO_STATUS.LOADING
  );
  const isTxInfoLoaded = () => (
    !isTxInfoLoading() && newTxStatus !== WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS.LOADING
  );
  const isTxProcessing = () => (
    !isTxInfoLoading() && newTxStatus === WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS.LOADING
  );
  const isTxSuccessful = () => newTxStatus === WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS.SUCCESSFUL;
  const isTxFailed = () => newTxStatus === WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS.FAILED;

  return (
    <>
      {notRegistered && (
        <FeedbackContent
          title={t`Nano Contract Not Found`}
          message={t`The Nano Contract requested is not registered. First register the Nano Contract to interact with it.`}
          action={(
            <NewHathorButton
              title={t`Decline Transaction`}
              onPress={onDeclineTransaction}
              secondary
              danger
            />
          )}
        />
      )}
      {showRequest && (
        <ScrollView style={styles.wide}>
          <TouchableWithoutFeedback>
            <View style={styles.wrapper}>
              {isTxInfoLoading() && (
                <FeedbackContent
                  title={t`Loading`}
                  message={t`Loading transaction information.`}
                  icon={<Spinner size={48} animating />}
                  offmargin
                  offcard
                  offbackground
                />
              )}
              {isTxInfoLoaded() && (
                <View style={styles.content}>
                  <DappContainer dapp={dapp} />
                  <NanoContractExecInfo
                    nc={ncToAccept}
                    onSelectAddress={toggleSelectAddressModal}
                  />
                  <NanoContractActions
                    ncActions={nc.actions}
                    tokens={knownTokens}
                    error={knownTokens.error}
                  />
                  <NanoContractMethodArgs
                    blueprintId={nc.blueprintId}
                    method={nc.method}
                    ncArgs={nc.args}
                  />

                  {/* User actions */}
                  <View style={styles.actionContainer}>
                    <NewHathorButton
                      title={t`Accept Transaction`}
                      onPress={onAcceptTransaction}
                    />
                    <NewHathorButton
                      title={t`Decline Transaction`}
                      onPress={onDeclineTransaction}
                      secondary
                      danger
                    />
                  </View>
                </View>
              )}
              {isTxProcessing() && (
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
          </TouchableWithoutFeedback>
        </ScrollView>
      )}

      <DeclineModal
        show={showDeclineModal}
        onDecline={onDeclineConfirmation}
        onDismiss={onDismissDeclineModal}
      />
      <SelectAddressModal
        address={ncAddress}
        show={showSelectAddressModal}
        onDismiss={toggleSelectAddressModal}
        onSelectAddress={handleAddressSelection}
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

const styles = StyleSheet.create({
  wide: {
    width: '100%'
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
  content: {
    flex: 1,
    rowGap: 24,
    width: '100%',
    paddingVertical: 16,
  },
  balanceReceived: {
    color: 'hsla(180, 85%, 34%, 1)',
    fontWeight: 'bold',
  },
  actionContainer: {
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 48,
  },
  declineModalBody: {
    paddingBottom: 24,
  },
  text: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
  feedbackModalIcon: {
    height: 105,
    width: 105
  },
});
