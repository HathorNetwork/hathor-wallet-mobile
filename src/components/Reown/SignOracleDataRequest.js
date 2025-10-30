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
import { useNavigation } from '@react-navigation/native';
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
                  <CopyClipboard
                    text={oracle.address}
                    style={styles.copyButton}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.dataContainer, styles.oracleDataContainer]}>
              <CopyClipboard
                text={oracle.raw}
                textStyle={styles.dataText}
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
  const navigation = useNavigation();
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const wallet = useSelector((state) => state.wallet);

  const parsedOracleInfo = useMemo(() => {
    try {
      if (!wallet || !data.oracle) {
        return { raw: data.oracle, isAddress: false };
      }

      const network = wallet.getNetworkObject();
      const address = new hathorLib.Address(data.oracle, { network });

      if (address.isValid()) {
        const outputScriptType = address.getType();
        return {
          raw: data.oracle,
          address: data.oracle,
          isAddress: true,
          scriptType: outputScriptType
        };
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

  const onAcceptSignOracleDataRequest = () => {
    // Signal the user has accepted the current request and pass the accepted data.
    dispatch(reownAccept());
    navigation.goBack();
  };

  const onDeclineConfirmation = () => {
    setShowDeclineModal(false);
    dispatch(reownReject());
    navigation.goBack();
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
    fontSize: 14,
    color: COLORS.textColor,
    lineHeight: 20,
    textAlign: 'left',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  copyButton: {
    padding: 4,
  },
  copyContainer: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  toggleText: {
    fontSize: 12,
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
  oracleDataContainer: {
    marginBottom: 12,
  },
  dataText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: COLORS.textColor,
    lineHeight: 20,
  },
});
