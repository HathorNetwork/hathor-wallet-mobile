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
import { ModalBase } from '../../ModalBase';
import { reownReject } from '../../../actions';
import { WarnDisclaimer } from '../WarnDisclaimer';
import { REOWN_SKIP_CONFIRMATION_MODAL } from '../../../config';

export const NewNanoContractTransactionModal = ({
  onDismiss,
  data,
}) => {
  const isRetrying = useSelector(({ reown }) => (
    reown.newNanoContractTransaction.retrying
  ));
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const onModalDismiss = useCallback(() => {
    dispatch(reownReject());
    onDismiss();
  }, [onDismiss]);

  const navigatesToNewNanoContractScreen = () => {
    onDismiss();
    navigation.navigate('NewNanoContractTransactionScreen', { ncTxRequest: data });
  };

  useEffect(() => {
    if (REOWN_SKIP_CONFIRMATION_MODAL || isRetrying) {
      navigatesToNewNanoContractScreen();
    }
  }, [isRetrying]);

  return (
    <ModalBase show onDismiss={onModalDismiss}>
      <ModalBase.Title>{t`New Nano Contract Transaction`}</ModalBase.Title>
      <ModalBase.Body style={styles.body}>
        <WarnDisclaimer />
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
  body: {
    paddingBottom: 24,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
  }
});
