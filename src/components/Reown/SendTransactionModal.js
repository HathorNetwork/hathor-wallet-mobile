/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { t } from 'ttag';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Clipboard, ActivityIndicator, Image } from 'react-native';
import { constants, numberUtils } from '@hathor/wallet-lib';
import { COLORS } from '../../styles/themes';
import { ModalBase } from '../ModalBase';
import { WarnDisclaimer } from './WarnDisclaimer';
import { reownReject, hideReownModal } from '../../actions';
import { REOWN_SKIP_CONFIRMATION_MODAL } from '../../config';
import NewHathorButton from '../NewHathorButton';
import { DappContainer } from './NanoContract/DappContainer';

const styles = StyleSheet.create({
  body: {
    paddingBottom: 24,
    backgroundColor: COLORS.lowContrastDetail,
  },
  content: {
    flex: 1,
    rowGap: 24,
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 16,
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
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    color: 'hsla(0, 0%, 38%, 1)',
  },
  successColor: {
    color: 'green',
  },
  errorColor: {
    color: 'red',
  },
});

export default ({
  onDismiss,
  data,
  onAcceptAction,
  onRejectAction,
}) => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { tokens: registeredTokens } = useSelector((state) => ({
    tokens: state.tokens,
  }));

  useEffect(() => {
    // Check for unregistered tokens, but we don't need to store them
    const unregisteredTokenUIDs = [];

    // Check inputs
    if (data?.data?.inputs) {
      for (const input of data.data.inputs) {
        if (input.token && !registeredTokens[input.token]) {
          unregisteredTokenUIDs.push(input.token);
        }
      }
    }

    // Check outputs
    if (data?.data?.outputs) {
      for (const output of data.data.outputs) {
        if (output.token && !registeredTokens[output.token]) {
          unregisteredTokenUIDs.push(output.token);
        }
      }
    }

    // We're not using the unregistered tokens for now
    // but keeping the check for future implementation
  }, [data, registeredTokens]);

  const getTokenSymbol = (tokenId) => {
    if (!tokenId) {
      return constants.DEFAULT_NATIVE_TOKEN_CONFIG.symbol;
    }

    const token = registeredTokens[tokenId];
    if (token) {
      return token.symbol;
    }

    return '?';
  };

  const formatValue = (value) => {
    if (value == null) {
      return '-';
    }

    return numberUtils.prettyValue(value);
  };

  const truncateTxId = (txId) => {
    if (!txId) return '-';
    return `${txId.slice(0, 12)}...${txId.slice(-12)}`;
  };

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
  };

  const renderInputs = () => {
    if (!data?.data?.inputs || data.data.inputs.length === 0) {
      return null;
    }

    return (
      <View>
        <Text style={styles.sectionTitle}>{t`Inputs`}</Text>
        {data.data.inputs.map((input, index) => {
          const inputKey = `input-${input.txId || ''}-${input.index || ''}-${index}`;
          return (
            <View
              key={inputKey}
              style={styles.itemContainer}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{t`Input ${index + 1}`}</Text>
                <Text style={styles.valueText}>
                  {formatValue(input?.value)} {getTokenSymbol(input?.token)}
                </Text>
              </View>
              <Text style={styles.labelText}>{t`ID da Transação`}</Text>
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
              <Text style={styles.labelText}>{t`Endereço`}</Text>
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
    if (!data?.data?.outputs || data.data.outputs.length === 0) {
      return null;
    }

    return (
      <View>
        <Text style={styles.sectionTitle}>{t`Outputs`}</Text>
        {data.data.outputs.map((output, index) => {
          const outputKey = `output-${output.address || ''}-${output.token || ''}-${Math.random().toString(36).substr(2, 9)}`;
          return (
            <View
              key={outputKey}
              style={styles.itemContainer}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{t`Output ${index + 1}`}</Text>
                <Text style={styles.valueText}>
                  {formatValue(output?.value)} {getTokenSymbol(output?.token)}
                </Text>
              </View>
              <Text style={styles.labelText}>{t`Endereço`}</Text>
              <TouchableOpacity
                style={styles.addressContainer}
                onPress={() => copyToClipboard(output?.address)}
              >
                <Text style={styles.monospace} numberOfLines={1}>
                  {output?.address}
                </Text>
              </TouchableOpacity>
              {output?.data && (
                <View>
                  <Text style={styles.labelText}>{t`Data field`}</Text>
                  <View style={styles.valueContainer}>
                    <Text style={styles.monospace}>
                      {output.data.join(',')}
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
    if (!data?.data?.changeAddress) {
      return null;
    }

    return (
      <View>
        <Text style={styles.sectionTitle}>{t`Change Address`}</Text>
        <View style={styles.itemContainer}>
          <Text style={styles.labelText}>{t`Endereço`}</Text>
          <TouchableOpacity
            style={styles.addressContainer}
            onPress={() => copyToClipboard(data.data.changeAddress)}
          >
            <Text style={styles.monospace} numberOfLines={1}>
              {data.data.changeAddress}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const onReject = () => {
    onDismiss();
    if (onRejectAction) {
      onRejectAction();
    } else {
      dispatch(reownReject());
    }
  };

  const onAccept = () => {
    // Don't dismiss the modal when accepting - the loading trigger will handle it
    if (onAcceptAction) {
      onAcceptAction(data?.data);
    }
    // Don't hide the modal - the loading trigger will update it
    // dispatch(hideReownModal());
  };

  const navigateToSendTransactionRequestScreen = () => {
    onDismiss();
    navigation.navigate('SendTransactionRequest', {
      sendTransactionRequest: data,
      onAccept: onAcceptAction,
      onReject: onRejectAction,
    });
  };

  useEffect(() => {
    if (REOWN_SKIP_CONFIRMATION_MODAL) {
      navigateToSendTransactionRequestScreen();
    }
  }, []);

  // Render loading state
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size='large' color={COLORS.primary} />
      <Text style={styles.loadingText}>{t`Processing transaction...`}</Text>
    </View>
  );

  // Render success state
  const renderSuccess = () => (
    <View style={styles.statusContainer}>
      <Text style={[styles.statusText, styles.successColor]}>{t`Transaction Successful!`}</Text>
      <Text style={styles.statusMessage}>{t`Your transaction has been successfully sent to the network.`}</Text>
      <View style={{ marginTop: 24 }}>
        <NewHathorButton
          title={t`Close`}
          onPress={() => dispatch(hideReownModal())}
        />
      </View>
    </View>
  );

  // Render error state
  const renderError = () => (
    <View style={styles.statusContainer}>
      <Text style={[styles.statusText, styles.errorColor]}>{t`Transaction Failed`}</Text>
      <Text style={styles.statusMessage}>
        {data?.errorMessage || t`There was an error processing your transaction. Please try again.`}
      </Text>
      <View style={{ marginTop: 24 }}>
        <NewHathorButton
          title={t`Close`}
          onPress={() => dispatch(hideReownModal())}
        />
      </View>
    </View>
  );

  // Determine the modal title based on the state
  const getModalTitle = () => {
    if (data?.isLoading) {
      return t`Processing Transaction`;
    }
    if (data?.isSuccess) {
      return t`Transaction Successful`;
    }
    if (data?.isError) {
      return t`Transaction Failed`;
    }
    return t`Transaction Request`;
  };

  // Render the appropriate content based on the state
  const renderContent = () => {
    if (data?.isLoading) {
      return renderLoading();
    }
    if (data?.isSuccess) {
      return renderSuccess();
    }
    if (data?.isError) {
      return renderError();
    }

    // Default transaction request view
    return (
      <>
        <DappContainer dapp={data?.dapp} />

        <View>
          <WarnDisclaimer />
        </View>

        {renderInputs()}
        {renderOutputs()}
        {renderChangeAddress()}

        <View style={styles.actionContainer}>
          <NewHathorButton
            title={t`Accept Transaction`}
            onPress={onAccept}
          />
          <NewHathorButton
            title={t`Decline Transaction`}
            onPress={onReject}
            secondary
            danger
          />
        </View>
      </>
    );
  };

  return (
    <ModalBase
      show
      onDismiss={data?.isLoading || data?.isSuccess || data?.isError ? () => {} : onReject}
    >
      <ModalBase.Title>
        <Text style={styles.modalTitle}>{getModalTitle()}</Text>
      </ModalBase.Title>
      <ModalBase.Body style={styles.body}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {renderContent()}
          </View>
        </ScrollView>
      </ModalBase.Body>
    </ModalBase>
  );
};
