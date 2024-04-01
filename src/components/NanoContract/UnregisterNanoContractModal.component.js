/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';
import { useNavigation } from '@react-navigation/native';
import { ModalBase } from '../ModalBase.component';
import { nanoContractUnregisterRequest } from '../../actions';

export const UnregisterNanoContractModal = ({ ncId, show, onDismiss }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const onUnregisterContract = () => {
    onDismiss();
    dispatch(nanoContractUnregisterRequest({ ncId }));
    navigation.navigate('Dashboard');
  };

  return (
    <ModalBase show={show} onDismiss={onDismiss}>
      <ModalBase.Title>{t`Unregister Contract`}</ModalBase.Title>
      <ModalBase.Body style={styles.body}>
        <Text style={[styles.text]}>{t`Are you sure you want to unregister this Nano Contract?`}</Text>
      </ModalBase.Body>
      <ModalBase.Button
        title={t`Yes, unregister contract`}
        secondary
        danger
        onPress={onUnregisterContract}
      />
      <ModalBase.DiscreteButton
        title={t`No, go back`}
        onPress={onDismiss}
      />
    </ModalBase>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingBottom: 20,
  },
  fieldContainer: {
    width: '100%',
    paddingBottom: 4,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
});
