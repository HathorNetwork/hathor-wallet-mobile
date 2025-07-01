/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useMemo } from 'react';
import hathorLib from '@hathor/wallet-lib';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import {
  reownAccept,
  reownReject
} from '../../actions';
import { COLORS } from '../../styles/themes';
import NewHathorButton from '../NewHathorButton';
import { DappContainer } from './NanoContract/DappContainer';
import { commonStyles } from './theme';
import { NanoContractIcon } from '../Icons/NanoContract.icon';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { DeclineModal } from './NanoContract/DeclineModal';
import CopyClipboard from '../CopyClipboard';

export const SignOracleDataRequestData = ({ oracle, data }) => {
  const [showRawData, setShowRawData] = useState(false);

  return (
    <View style={[commonStyles.card, commonStyles.cardSplit]}>
      <View style={commonStyles.cardSplitIcon}>
        <NanoContractIcon type='fill' color={COLORS.white} />
      </View>
      <View style={styles.oracleSection}>
        {/* Oracle Section */}
        <View>
          <Text style={styles.property}>{t`Oracle`}</Text>

          {oracle.isAddress ? (
            <View>
              <View style={[styles.labelContainer]}>
                <Text style={styles.subLabel}>
                  {t`Address`} {oracle.scriptType && `(${oracle.scriptType})`}
                </Text>
              </View>

              <View style={styles.valueContainer}>
                <View style={styles.valueBox}>
                  <Text style={styles.valueText}>
                    {oracle.address}
                  </Text>
                </View>
                <CopyClipboard
                  data={oracle.address}
                  style={styles.copyButton}
                />
              </View>

              {/* Collapsible raw oracle data */}
              <TouchableOpacity
                style={styles.toggleContainer}
                onPress={() => setShowRawData(!showRawData)}
              >
                <Text style={styles.toggleText}>
                  {showRawData ? t`Hide raw oracle data` : t`Show raw oracle data`}
                </Text>
                <Text style={styles.toggleIcon}>
                  {showRawData ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>

              {showRawData && (
                <View style={styles.valueContainer}>
                  <View style={styles.valueBox}>
                    <Text style={styles.valueText}>
                      {oracle.raw}
                    </Text>
                  </View>
                  <CopyClipboard
                    data={oracle.raw}
                    style={styles.copyButton}
                  />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.valueContainer}>
              <View style={styles.valueBox}>
                <Text style={styles.valueText}>
                  {oracle.raw}
                </Text>
              </View>
              <CopyClipboard
                data={oracle.raw}
                style={styles.copyButton}
              />
            </View>
          )}
        </View>

        <View style={commonStyles.cardSeparator} />

        {/* Data Section */}
        <View>
          <Text style={styles.property}>{t`Data`}</Text>
          <View style={styles.dataContainer}>
            <Text style={styles.dataText}>{data}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export const SignOracleDataRequest = ({ signOracleData }) => {
  const { dapp, data } = signOracleData;
  const dispatch = useDispatch();
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const wallet = useSelector((state) => state.wallet);

  const parsedOracleInfo = useMemo(() => {
    try {
      if (!wallet || !data.oracle) {
        return { raw: data.oracle, isAddress: false };
      }

      // Convert hex string to Buffer
      const oracleBuffer = Buffer.from(data.oracle, 'hex');
      const network = wallet.getNetworkObject();

      // Try to parse using available script parsing methods
      if (hathorLib.scriptsUtils && hathorLib.scriptsUtils.parseScript) {
        const parsedScript = hathorLib.scriptsUtils.parseScript(oracleBuffer, network);
        if (parsedScript && parsedScript.address) {
          return {
            raw: data.oracle,
            address: parsedScript.address.base58 || parsedScript.address,
            isAddress: true,
            scriptType: parsedScript.type
          };
        }
      }

      return { raw: data.oracle, isAddress: false };
    } catch (error) {
      // If any error occurs, fall back to raw display
      return { raw: data.oracle, isAddress: false };
    }
  }, [data.oracle, wallet]);

  const onDeclineTransaction = () => {
    setShowDeclineModal(true);
  };

  const { navigateBack } = useBackButtonHandler(
    onDeclineTransaction,
  );

  const onAcceptSignOracleDataRequest = () => {
    // Signal the user has accepted the current request and pass the accepted data.
    dispatch(reownAccept());
  };

  const onDeclineConfirmation = () => {
    setShowDeclineModal(false);
    dispatch(reownReject());
    navigateBack();
  };

  const onDismissDeclineModal = () => {
    setShowDeclineModal(false);
  };

  return (
    <>
      <ScrollView style={styles.wide}>
        <TouchableWithoutFeedback>
          <View style={styles.wrapper}>
            <View style={styles.content}>
              <DappContainer dapp={dapp} />
              <SignOracleDataRequestData oracle={parsedOracleInfo} data={data.data} />
              {/* User actions */}
              <View style={styles.actionContainer}>
                <NewHathorButton
                  title={t`Accept Request`}
                  onPress={onAcceptSignOracleDataRequest}
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
        </TouchableWithoutFeedback>
      </ScrollView>
      <DeclineModal
        show={showDeclineModal}
        onDecline={onDeclineConfirmation}
        onDismiss={onDismissDeclineModal}
      />
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
  oracleSection: {
    flex: 1,
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
  value: [commonStyles.text, commonStyles.value],
  property: [
    commonStyles.text,
    commonStyles.field,
    commonStyles.bold,
    commonStyles.mb4,
    commonStyles.mt8
  ],
  labelContainer: {
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    color: COLORS.textColorShadow,
    fontWeight: '500',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  valueBox: {
    flex: 1,
    backgroundColor: COLORS.lowContrastDetail,
    padding: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  valueText: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: COLORS.textColor,
    lineHeight: 24,
    textAlign: 'left',
  },
  copyButton: {
    padding: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  toggleText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  toggleIcon: {
    fontSize: 12,
    color: COLORS.primary,
    marginLeft: 8,
  },
  dataContainer: {
    backgroundColor: COLORS.lowContrastDetail,
    padding: 12,
    borderRadius: 8,
  },
  dataText: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: COLORS.textColor,
    lineHeight: 20,
  },
});
