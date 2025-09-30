/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Image } from 'react-native';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';
import FeedbackModal from '../FeedbackModal';
import NewHathorButton from '../NewHathorButton';
import { hideReownModal, setSendTxStatusReady } from '../../actions';
import errorIcon from '../../assets/images/icErrorBig.png';

/**
 * Modal displayed when there are insufficient funds for a transaction
 */
export const EnrichmentFailedModal = () => {
  const dispatch = useDispatch();

  // Reset transaction status when component unmounts
  useEffect(() => () => {
    dispatch(setSendTxStatusReady());
  }, []);

  const handleDismiss = () => {
    // Reset the transaction status to prevent it from affecting future transactions
    dispatch(setSendTxStatusReady());
    dispatch(hideReownModal());
  };

  return (
    <FeedbackModal
      icon={<Image source={errorIcon} style={styles.icon} resizeMode='contain' />}
      text={t`Received a Nano Contract Transaction request but was unable to fetch the blueprint information.`}
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

export default EnrichmentFailedModal;
