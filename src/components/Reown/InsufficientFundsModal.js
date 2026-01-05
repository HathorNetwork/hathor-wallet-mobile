/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Image, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import FeedbackModal from '../FeedbackModal';
import NewHathorButton from '../NewHathorButton';
import AdvancedErrorOptions from './AdvancedErrorOptions';
import { hideReownModal, setSendTxStatusReady } from '../../actions';
import errorIcon from '../../assets/images/icErrorBig.png';

/**
 * Modal displayed when there are insufficient funds for a transaction
 */
export const InsufficientFundsModal = () => {
  const dispatch = useDispatch();
  const errorDetails = useSelector((state) => state.reown.error);

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
      text={t`Insufficient funds to complete the transaction.`}
      onDismiss={handleDismiss}
      action={(
        <View style={styles.buttonContainer}>
          <NewHathorButton title={t`Close`} onPress={handleDismiss} />
          <AdvancedErrorOptions errorDetails={errorDetails} />
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  icon: {
    width: 48,
    height: 48,
  },
  buttonContainer: {
    width: '100%',
    gap: 8,
  },
});

export default InsufficientFundsModal;
