/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Image } from 'react-native';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';
import FeedbackModal from '../FeedbackModal';
import NewHathorButton from '../NewHathorButton';
import { hideReownModal } from '../../actions';
import errorIcon from '../../assets/images/icErrorBig.png';

/**
 * Modal displayed when there are insufficient funds for a transaction
 */
export const InsufficientFundsModal = () => {
  const dispatch = useDispatch();

  const handleDismiss = () => {
    dispatch(hideReownModal());
  };

  return (
    <FeedbackModal
      icon={<Image source={errorIcon} style={styles.icon} resizeMode='contain' />}
      text={t`Insufficient funds to complete the transaction.`}
      onDismiss={handleDismiss}
      action={<NewHathorButton title={t`Close`} onPress={handleDismiss} />}
    />
  );
};

const styles = StyleSheet.create({
  icon: {
    width: 48,
    height: 48,
  },
});

export default InsufficientFundsModal;