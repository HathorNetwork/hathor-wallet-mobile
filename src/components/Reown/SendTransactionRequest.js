/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Clipboard } from 'react-native';
import { constants, numberUtils } from '@hathor/wallet-lib';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS } from '../../styles/themes';
import NewHathorButton from '../NewHathorButton';
import { WarnDisclaimer } from './WarnDisclaimer';
import { DappContainer } from './NanoContract/DappContainer';
import { hideReownModal } from '../../actions';

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
});

export const SendTransactionRequest = ({ sendTransactionRequest, onAccept, onReject }) => {
  const { dapp, data } = sendTransactionRequest;
  const { tokens: registeredTokens } = useSelector((state) => ({
    tokens: state.tokens,
  }));
  const dispatch = useDispatch();

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
    if (!data?.changeAddress) {
      return null;
    }

    return (
      <View>
        <Text style={styles.sectionTitle}>{t`Change Address`}</Text>
        <View style={styles.itemContainer}>
          <Text style={styles.labelText}>{t`Endereço`}</Text>
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

  const onAcceptTransaction = () => {
    if (onAccept) {
      onAccept(data);
    }
    dispatch(hideReownModal());
  };

  const onRejectTransaction = () => {
    if (onReject) {
      onReject();
    }
    dispatch(hideReownModal());
  };

  return (
    <ScrollView style={styles.wide}>
      <View style={styles.wrapper}>
        <View style={styles.content}>
          <DappContainer dapp={dapp} />

          <View>
            <WarnDisclaimer />
          </View>

          {renderInputs()}
          {renderOutputs()}
          {renderChangeAddress()}

          <View style={styles.actionContainer}>
            <NewHathorButton
              title={t`Accept Transaction`}
              onPress={onAcceptTransaction}
            />
            <NewHathorButton
              title={t`Decline Transaction`}
              onPress={onRejectTransaction}
              secondary
              danger
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
