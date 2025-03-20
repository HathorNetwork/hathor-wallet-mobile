/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useRef, useState } from 'react';
import { t } from 'ttag';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Clipboard, Image } from 'react-native';
import { constants, helpersUtils, numberUtils } from '@hathor/wallet-lib';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../styles/themes';
import NewHathorButton from '../NewHathorButton';
import { WarnDisclaimer } from './WarnDisclaimer';
import { DappContainer } from './NanoContract/DappContainer';
import {
  setSendTxStatusReady,
  unregisteredTokensDownloadRequest,
  reownReject,
  sendTxRetry,
  sendTxRetryDismiss
} from '../../actions';
import { REOWN_SEND_TX_STATUS, DEFAULT_TOKEN } from '../../constants';
import FeedbackModal from '../FeedbackModal';
import errorIcon from '../../assets/images/icErrorBig.png';
import { FeedbackContent } from '../FeedbackContent';
import Spinner from '../Spinner';
import { DeclineModal } from './NanoContract/DeclineModal';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';

const styles = StyleSheet.create({
  wide: {
    width: '100%',
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: COLORS.lowContrastDetail,
  },
  content: {
    flex: 1,
    rowGap: 24,
    width: '100%',
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  itemContainer: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    alignItems: 'center',
  },
  itemTitle: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
  },
  labelText: {
    fontSize: 14,
    color: 'hsla(0, 0%, 38%, 1)',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  valueContainer: {
    backgroundColor: COLORS.lowContrastDetail,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  monospace: {
    fontFamily: 'Courier',
    fontSize: 14,
  },
  copyButton: {
    color: 'hsla(263, 100%, 64%, 1)',
    marginTop: 4,
  },
  addressContainer: {
    backgroundColor: COLORS.lowContrastDetail,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  actionContainer: {
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 48,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  successText: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    color: 'green',
  },
  errorIcon: {
    fontSize: 48,
  },
  feedbackModalIcon: {
    width: 48,
    height: 48,
  },
});

export const SendTransactionRequest = ({ sendTransactionRequest, onAccept, onReject }) => {
  const { dapp = {}, data = {} } = sendTransactionRequest || {};
  const {
    tokens: registeredTokens,
    unregisteredTokens,
    reown,
    tokenMetadata,
  } = useSelector((state) => ({
    tokens: state.tokens,
    tokenMetadata: state.tokenMetadata,
    unregisteredTokens: state.unregisteredTokens,
    reown: state.reown
  }));

  // Combine registered and unregistered tokens
  const knownTokens = { ...registeredTokens, ...unregisteredTokens };

  const dispatch = useDispatch();
  const navigation = useNavigation();

  // Track tokens we've already requested to prevent duplicate requests
  const requestedTokensRef = useRef(new Set());

  // State for decline modal
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  // Get transaction status from Redux
  const sendTxStatus = reown.sendTransaction?.status || REOWN_SEND_TX_STATUS.READY;
  const sendTxRetrying = reown.sendTransaction?.retrying || false;

  // Show decline confirmation modal
  const onDeclineTransaction = () => {
    setShowDeclineModal(true);
  };

  // Use back button handler
  const { navigateBack } = useBackButtonHandler(
    onDeclineTransaction,
    sendTxStatus === REOWN_SEND_TX_STATUS.SUCCESSFUL
  );

  // Request information for any unknown tokens
  useEffect(() => {
    // Only process if we have data and it hasn't been processed yet
    if (data && data.inputs?.length > 0) {
      // Collect all token UIDs from both inputs and outputs
      const unknownTokensUid = [];

      // Check tokens in inputs
      const inputTokenIds = data.inputs?.map((input) => input.token).filter(Boolean) || [];
      // Check tokens in outputs
      const outputTokenIds = data.outputs?.map((output) => output.token).filter(Boolean) || [];

      // Combine all token IDs
      const allTokenIds = [...new Set([...inputTokenIds, ...outputTokenIds])];

      // Find unknown tokens that we haven't requested yet
      allTokenIds.forEach((uid) => {
        if (uid !== DEFAULT_TOKEN.uid
          && !(uid in registeredTokens)
          && !(uid in unregisteredTokens)
          && !requestedTokensRef.current.has(uid)
        ) {
          unknownTokensUid.push(uid);
          requestedTokensRef.current.add(uid);
        }
      });

      // Request download of unknown tokens
      if (unknownTokensUid.length > 0) {
        dispatch(unregisteredTokensDownloadRequest({ uids: unknownTokensUid }));
      }
    }
  }, [data, registeredTokens, unregisteredTokens, dispatch]);

  // Check if tokens are still loading
  const isTokenDataLoading = () => unregisteredTokens.isLoading;

  // Update the getTokenSymbol function to use knownTokens
  const getTokenSymbol = (tokenId) => {
    // Check if it's explicitly the native token UID
    if (tokenId === constants.NATIVE_TOKEN_UID) {
      return constants.DEFAULT_NATIVE_TOKEN_CONFIG.symbol;
    }

    const token = knownTokens[tokenId];
    if (token) {
      return token.symbol;
    }

    // We return an empty string as a fallback for tokens that are not yet
    // loaded or recognized
    // This should be temporary until the token details are fetched
    // The unregisteredTokensDownloadRequested action should be loading these
    // details
    return '';
  };

  const formatValue = (value, tokenId) => {
    if (value == null) {
      return '-';
    }

    const isNFT = tokenId && helpersUtils.isTokenNFT(tokenId, tokenMetadata);

    return numberUtils.prettyValue(value, isNFT ? 0 : constants.DECIMAL_PLACES);
  };

  const truncateTxId = (txId) => {
    if (!txId) return '-';
    return `${txId.slice(0, 12)}...${txId.slice(-12)}`;
  };

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
  };

  const renderInputs = () => {
    if (!data?.inputs || data.inputs.length === 0) {
      return null;
    }

    return (
      <View>
        <Text style={styles.sectionTitle}>{t`Inputs`}</Text>
        {data.inputs.map((input, index) => {
          const inputKey = `input-${input.txId || ''}-${input.index || ''}-${index}`;
          return (
            <View
              key={inputKey}
              style={styles.itemContainer}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{t`Input`} {index + 1}</Text>
                <Text style={styles.valueText}>
                  {formatValue(input?.value)} {getTokenSymbol(input?.token)}
                </Text>
              </View>
              <Text style={styles.labelText}>{t`Transaction ID`}</Text>
              <View style={styles.valueContainer}>
                <Text style={styles.monospace}>
                  {truncateTxId(input?.txId)} ({input?.index})
                </Text>
                {input?.txId && (
                  <TouchableOpacity onPress={() => copyToClipboard(input.txId)}>
                    <Text style={styles.copyButton}>{t`Copy ID`}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.labelText}>{t`Address`}</Text>
              <TouchableOpacity
                style={styles.addressContainer}
                onPress={() => copyToClipboard(input?.address)}
              >
                <Text style={styles.monospace} numberOfLines={1}>
                  {input?.address}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  const renderOutputs = () => {
    if (!data?.outputs || data.outputs.length === 0) {
      return null;
    }

    return (
      <View>
        <Text style={styles.sectionTitle}>{t`Outputs`}</Text>
        {data.outputs.map((output, index) => {
          const outputKey = `output-${output.address || ''}-${index}`;
          return (
            <View
              key={outputKey}
              style={styles.itemContainer}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{t`Output`} {index + 1}</Text>
                <Text style={styles.valueText}>
                  {formatValue(output?.value)} {getTokenSymbol(output?.token)}
                </Text>
              </View>
              {output?.address && (
                <>
                  <Text style={styles.labelText}>{t`Address`}</Text>
                  <TouchableOpacity
                    style={styles.addressContainer}
                    onPress={() => copyToClipboard(output?.address)}
                  >
                    <Text style={styles.monospace} numberOfLines={1}>
                      {output?.address}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              {output?.data && (
                <View>
                  <Text style={styles.labelText}>{t`Data field`}</Text>
                  <View style={styles.valueContainer}>
                    <Text style={styles.monospace}>
                      {output.data}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderChangeAddress = () => {
    if (!data?.changeAddress) {
      return null;
    }

    return (
      <View>
        <Text style={styles.sectionTitle}>{t`Change Address`}</Text>
        <View style={styles.itemContainer}>
          <TouchableOpacity
            style={styles.addressContainer}
            onPress={() => copyToClipboard(data.changeAddress)}
          >
            <Text style={styles.monospace} numberOfLines={1}>
              {data.changeAddress}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Accept transaction
  const onAcceptTransaction = () => {
    onAccept(data);
  };

  // Confirm decline
  const onDeclineConfirmation = () => {
    setShowDeclineModal(false);
    if (onReject && typeof onReject === 'function') {
      onReject();
    }
    dispatch(reownReject());
    navigateBack();
  };

  // Dismiss decline modal without taking action
  const onDismissDeclineModal = () => {
    onDeclineConfirmation();
  };

  // Status check functions
  const isTxDataLoading = () => isTokenDataLoading();
  const isTxProcessing = () => sendTxStatus === REOWN_SEND_TX_STATUS.LOADING || isTxDataLoading();
  const isTxFailed = () => sendTxStatus === REOWN_SEND_TX_STATUS.FAILED;
  const isTxSuccessful = () => sendTxStatus === REOWN_SEND_TX_STATUS.SUCCESSFUL;

  // Handle retry logic
  const onTryAgain = () => {
    dispatch(setSendTxStatusReady());
    dispatch(sendTxRetry());
  };

  // Handle dismiss modal
  const onFeedbackModalDismiss = () => {
    navigateBack();
  };

  // Clean up when component unmounts
  useEffect(
    () => () => {
      // Dismiss any retry condition
      dispatch(sendTxRetryDismiss());
      // Restore ready status
      dispatch(setSendTxStatusReady());
    },
    []
  );

  // Navigate to success screen on successful transaction
  useEffect(() => {
    if (isTxSuccessful()) {
      navigation.navigate(
        'SuccessFeedbackScreen',
        {
          title: t`Success!`,
          message: t`Transaction successfully sent.`,
        }
      );
      // Restore ready status
      dispatch(setSendTxStatusReady());
    }
  }, [sendTxStatus]);

  return (
    <>
      {/* Loading state */}
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

      {/* Main content - only show when not in processing state */}
      {!isTxProcessing() && (
        <ScrollView style={styles.wide}>
          <View style={styles.wrapper}>
            <View style={styles.content}>
              {dapp && <DappContainer dapp={dapp} />}

              <View>
                <WarnDisclaimer />
              </View>

              {renderInputs()}
              {renderOutputs()}
              {renderChangeAddress()}

              <View style={styles.actionContainer}>
                {/* Hide action buttons when in success state */}
                {!isTxSuccessful() && !isTxFailed() && (
                  <>
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
                  </>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Error modal */}
      {isTxFailed() && (
        <FeedbackModal
          icon={<Image source={errorIcon} style={styles.feedbackModalIcon} resizeMode='contain' />}
          text={t`Error while sending transaction.`}
          onDismiss={onFeedbackModalDismiss}
          action={<NewHathorButton discrete title={t`Try again`} onPress={onTryAgain} />}
        />
      )}

      {/* Decline confirmation modal */}
      <DeclineModal
        show={showDeclineModal}
        onDecline={onDeclineConfirmation}
        onDismiss={onDismissDeclineModal}
      />
    </>
  );
};
