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
import { hideReownModal, reownReject, setForceNavigateToDashboard } from '../../actions';
import errorIcon from '../../assets/images/icErrorBig.png';

/**
 * Generic modal displayed when a Reown request fails before user confirmation
 * Shows error details and allows the user to dismiss (rejecting the dApp request)
 *
 * If `navigateOnDismiss` is true in modal data, navigates to Dashboard on dismiss.
 * This is used for timeout errors where the user may be on a detail screen.
 */
export const RequestErrorModal = () => {
  const dispatch = useDispatch();
  const reownModal = useSelector((state) => state.reown.modal);
  const errorDetails = useSelector((state) => state.reown.error);

  const errorMessage = reownModal.data?.errorMessage || t`An error occurred while processing the request.`;
  const navigateOnDismiss = reownModal.data?.navigateOnDismiss || false;

  // Reject the dApp request when component unmounts
  useEffect(() => () => {
    dispatch(reownReject());
  }, []);

  const handleDismiss = () => {
    dispatch(reownReject());
    dispatch(hideReownModal());

    // Signal the Reown screen to navigate to Main if requested
    // The screen (via useReownSignal) will handle navigation using replace
    if (navigateOnDismiss) {
      dispatch(setForceNavigateToDashboard(true));
    }
  };

  return (
    <FeedbackModal
      icon={<Image source={errorIcon} style={styles.icon} resizeMode='contain' />}
      text={errorMessage}
      onDismiss={handleDismiss}
      action={(
        <View style={styles.buttonContainer}>
          <NewHathorButton title={t`Dismiss`} onPress={handleDismiss} />
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

export default RequestErrorModal;
