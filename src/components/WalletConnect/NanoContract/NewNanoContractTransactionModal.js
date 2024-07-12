/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
} from 'react-native';
import { t } from 'ttag';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { COLORS } from '../../../styles/themes';
import { ModalBase } from '../../ModalBase';
import { walletConnectReject } from '../../../actions';
import { NANO_CONTRACT_INFO_URL } from '../../../constants';
import { WarnDisclaimer } from '../WarnDisclaimer';

export const NewNanoContractTransactionModal = ({
  onDismiss,
  data,
}) => {
  const isRetrying = useSelector(({ walletConnect }) => (
    walletConnect.newNanoContractTransaction.retrying
  ));
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const readMoreUrl = NANO_CONTRACT_INFO_URL;

  const onModalDismiss = useCallback(() => {
    dispatch(walletConnectReject());
    onDismiss();
  }, [onDismiss]);

  const navigatesToNewNanoContractScreen = () => {
    onDismiss();
    navigation.navigate('NewNanoContractTransactionScreen', { ncTxRequest: data });
  };

  useEffect(() => {
    if (isRetrying) {
      navigatesToNewNanoContractScreen();
    }
  }, [isRetrying, navigation]);

  // XXX: Make it navigates to readMoreUrl
  const onReadMore = () => {};

  return (
    <ModalBase show onDismiss={onModalDismiss}>
      <ModalBase.Title>{t`New Nano Contract Transaction`}</ModalBase.Title>
      <ModalBase.Body style={styles.body}>
        <WarnDisclaimer onReadMore={onReadMore} />
        <Text style={styles.text}>
          {t`You have received a new Nano Contract Transaction. Please`}
          <Text style={styles.bold}>
            {' '}{t`carefully review the details`}{' '}
          </Text>
          {t`before deciding to accept or decline.`}
        </Text>
      </ModalBase.Body>
      <ModalBase.Button
        title={t`Review transaction details`}
        onPress={navigatesToNewNanoContractScreen}
      />
      <ModalBase.DiscreteButton
        title={t`Cancel`}
        onPress={onModalDismiss}
      />
    </ModalBase>
  );
};

const styles = StyleSheet.create({
  pd0: {
    paddingBottom: 0,
  },
  pd8: {
    paddingBottom: 8,
  },
  body: {
    paddingBottom: 24,
  },
  fieldContainer: {
    width: '100%',
    paddingBottom: 4,
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
});
