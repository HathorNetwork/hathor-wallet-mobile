/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { t } from 'ttag';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { constants, numberUtils } from '@hathor/wallet-lib';
import { COLORS } from '../../styles/themes';
import { ModalBase } from '../ModalBase';
import { WarnDisclaimer } from './WarnDisclaimer';
import { reownReject } from '../../actions';
import { REOWN_SKIP_CONFIRMATION_MODAL } from '../../config';
import SimpleButton from '../SimpleButton';
import CopyClipboard from '../CopyClipboard';

const styles = StyleSheet.create({
  body: {
    paddingBottom: 24,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
  },
  selectionContainer: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.freeze100,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  itemContainer: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemTitle: {
    fontWeight: 'bold',
  },
  monospace: {
    fontFamily: 'Courier',
    fontSize: 12,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dappInfo: {
    marginBottom: 16,
  },
  dappName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dappUrl: {
    fontSize: 12,
    color: COLORS.textColorShadow,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  truncatedText: {
    maxWidth: '80%',
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
  const { tokenMetadata, tokens: registeredTokens } = useSelector((state) => ({
    tokenMetadata: state.tokenMetadata,
    tokens: state.tokens,
  }));

  useEffect(() => {
    // Collect all unregistered token UIDs
    const unregisteredTokens = new Set();

    data?.data?.inputs?.forEach((input) => {
      const token = registeredTokens.find((t) => t.uid === input.token);
      if (!token && input.token) {
        unregisteredTokens.add(input.token);
      }
    });

    data?.data?.outputs?.forEach((output) => {
      const token = registeredTokens.find((t) => t.uid === output.token);
      if (!token && output.token) {
        unregisteredTokens.add(output.token);
      }
    });

    // TODO: Add action to download unregistered tokens if needed
  }, [data, registeredTokens, dispatch]);

  const getTokenSymbol = (tokenId) => {
    if (!tokenId) {
      return constants.DEFAULT_NATIVE_TOKEN_CONFIG.symbol;
    }

    const token = registeredTokens.find((t) => t.uid === tokenId);
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
    return `${txId.slice(0, 8)}...${txId.slice(-8)}`;
  };

  const renderInputs = () => {
    if (!data?.data?.inputs || data.data.inputs.length === 0) {
      return null;
    }

    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.sectionTitle}>{t`Inputs`}</Text>
        {data.data.inputs.map((input, index) => {
          const inputKey = `input-${input.txId || ''}-${input.index || ''}-${Math.random().toString(36).substr(2, 9)}`;
          return (
            <View
              key={inputKey}
              style={styles.itemContainer}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{t`Input ${index + 1}`}</Text>
                <Text>{formatValue(input?.value)} {getTokenSymbol(input?.token)}</Text>
              </View>
              <View>
                <Text style={styles.monospace}>
                  {truncateTxId(input?.txId)} ({input?.index})
                </Text>
                {input?.txId && (
                  <CopyClipboard textToCopy={input.txId} />
                )}
              </View>
              <View style={styles.addressContainer}>
                <Text style={[styles.monospace, styles.truncatedText]} numberOfLines={1}>
                  {input?.address}
                </Text>
                {input?.address && (
                  <CopyClipboard textToCopy={input.address} />
                )}
              </View>
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
      <View style={{ marginBottom: 16 }}>
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
                <Text>{formatValue(output?.value)} {getTokenSymbol(output?.token)}</Text>
              </View>
              <View style={styles.addressContainer}>
                <Text style={[styles.monospace, styles.truncatedText]} numberOfLines={1}>
                  {output?.address}
                </Text>
                <CopyClipboard textToCopy={output?.address} />
              </View>
              {output?.data && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 12 }}>{t`Data field:`}</Text>
                  <Text style={styles.monospace}>
                    {output.data.join(',')}
                  </Text>
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
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.sectionTitle}>{t`Change Address`}</Text>
        <View style={styles.itemContainer}>
          <View style={styles.addressContainer}>
            <Text style={[styles.monospace, styles.truncatedText]} numberOfLines={1}>
              {data.data.changeAddress}
            </Text>
            <CopyClipboard textToCopy={data.data.changeAddress} />
          </View>
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
    onDismiss();
    if (onAcceptAction) {
      onAcceptAction(data?.data);
    }
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

  return (
    <ModalBase show onDismiss={onReject}>
      <ModalBase.Title>{t`New Transaction Request`}</ModalBase.Title>
      <ModalBase.Body style={styles.body}>
        <ScrollView>
          <View style={styles.dappInfo}>
            <Text style={styles.dappName}>{data?.dapp?.proposer}</Text>
            <Text style={styles.dappUrl}>{data?.dapp?.url}</Text>
          </View>

          {renderInputs()}
          {renderOutputs()}
          {renderChangeAddress()}

          <View style={styles.buttonContainer}>
            <SimpleButton
              title={t`Reject`}
              onPress={onReject}
              style={{ backgroundColor: COLORS.lightGray }}
              textStyle={{ color: COLORS.textColor }}
            />
            <SimpleButton
              title={t`Accept`}
              onPress={onAccept}
              style={{ backgroundColor: COLORS.primary }}
              textStyle={{ color: COLORS.white }}
            />
          </View>
        </ScrollView>
      </ModalBase.Body>
    </ModalBase>
  );
};
