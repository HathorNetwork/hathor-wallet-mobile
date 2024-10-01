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
import { t } from 'ttag';
import { ModalBase } from '../../ModalBase';

/**
 * It renders a confirmation modal to decline the tranaction creation.
 *
 * @param {Object} props
 * @param {boolean} props.show Flag that determines the if the modal should appear or not.
 * @param {() => void} props.onDecline Callback fn for decline action.
 * @param {() => void} props.onDismiss Callback fn for dismiss action.
 */
export const DeclineModal = ({ show, onDecline, onDismiss }) => (
  <ModalBase show={show} onDismiss={onDismiss}>
    <ModalBase.Title>{t`Decline transaction`}</ModalBase.Title>
    <ModalBase.Body style={styles.declineModalBody}>
      <Text style={styles.text}>
        {t`Are you sure you want to decline this transaction?`}
      </Text>
    </ModalBase.Body>
    <ModalBase.Button
      title={t`Yes, decline transaction`}
      secondary
      danger
      onPress={onDecline}
    />
    <ModalBase.DiscreteButton
      title={t`No, go back`}
      onPress={onDismiss}
    />
  </ModalBase>
);

const styles = StyleSheet.create({
  declineModalBody: {
    paddingBottom: 24,
  },
  text: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
});
