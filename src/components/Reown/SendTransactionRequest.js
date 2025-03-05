/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { constants, numberUtils } from '@hathor/wallet-lib';
import { useSelector } from 'react-redux';
import { COLORS } from '../../styles/themes';
import SimpleButton from '../SimpleButton';
import CopyClipboard from '../CopyClipboard';
import { WarnDisclaimer } from './WarnDisclaimer';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
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
  warningContainer: {
    marginBottom: 16,
  },
});

export const SendTransactionRequest = ({ sendTransactionRequest, onAccept, onReject }) => {
  const { dapp, data } = sendTransactionRequest;
  const { tokens: registeredTokens } = useSelector((state) => ({
    tokens: state.tokens,
  }));

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
    if (!data?.inputs || data.inputs.length === 0) {
      return null;
    }

    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.sectionTitle}>{t`Inputs`}</Text>
        {data.inputs.map((input, index) => {
          const inputKey = `input-${input.txId || ''}-${input.index || ''}-${index}`;
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
    if (!data?.outputs || data.outputs.length === 0) {
      return null;
    }

    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.sectionTitle}>{t`Outputs`}</Text>
        {data.outputs.map((output, index) => {
          const outputKey = `output-${output.address || ''}-${index}`;
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
    if (!data?.changeAddress) {
      return null;
    }

    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={styles.sectionTitle}>{t`Change Address`}</Text>
        <View style={styles.itemContainer}>
          <View style={styles.addressContainer}>
            <Text style={[styles.monospace, styles.truncatedText]} numberOfLines={1}>
              {data.changeAddress}
            </Text>
            <CopyClipboard textToCopy={data.changeAddress} />
          </View>
        </View>
      </View>
    );
  };


  const onAcceptTransaction = () => {
    if (onAccept) {
      onAccept(data);
    }
  };


  const onRejectTransaction = () => {
    if (onReject) {
      onReject();
    }
  };


  return (
    <View style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>{t`Transaction Request`}</Text>

        <View style={styles.warningContainer}>
          <WarnDisclaimer />
        </View>

        <View style={styles.dappInfo}>
          <Text style={styles.dappName}>{dapp?.proposer}</Text>
          <Text style={styles.dappUrl}>{dapp?.url}</Text>
        </View>

        {renderInputs()}
        {renderOutputs()}
        {renderChangeAddress()}

        <View style={styles.buttonContainer}>
          <SimpleButton
            title={t`Reject`}
            onPress={onRejectTransaction}
            style={{ backgroundColor: COLORS.lightGray }}
            textStyle={{ color: COLORS.textColor }}
          />
          <SimpleButton
            title={t`Accept`}
            onPress={onAcceptTransaction}
            style={{ backgroundColor: COLORS.primary }}
            textStyle={{ color: COLORS.white }}
          />
        </View>
      </ScrollView>
    </View>
  );
};
