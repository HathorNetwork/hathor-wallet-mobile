/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableWithoutFeedback,
  Text,
} from 'react-native';
import { useDispatch } from 'react-redux';
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

export const SignOracleDataRequestData = ({ data }) => (
  <View style={[commonStyles.card, commonStyles.cardSplit]}>
    <View style={commonStyles.cardSplitIcon}>
      <NanoContractIcon type='fill' color={COLORS.white} />
    </View>
    <View style={commonStyles.cardSplitContent}>
      <View>
        <Text style={styles.property}>{t`Oracle data to sign`}</Text>
        <Text style={styles.value}>{data.data}</Text>
      </View>
      <View style={commonStyles.cardSeparator} />
      <View>
        <Text style={styles.property}>{t`Oracle`}</Text>
        <Text style={styles.value}>{data.oracle}</Text>
      </View>
    </View>
  </View>
);

export const SignOracleDataRequest = ({ signOracleData }) => {
  const { dapp, data } = signOracleData;
  const dispatch = useDispatch();
  const [showDeclineModal, setShowDeclineModal] = useState(false);

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
              <SignOracleDataRequestData data={data} />
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
  property: [commonStyles.text, commonStyles.field, commonStyles.bold, commonStyles.mb4],
});
