/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useCallback, useEffect } from 'react';
import { Text } from 'react-native';
import { t } from 'ttag';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { ModalBase } from '../ModalBase';
import { reownReject } from '../../actions';
import { WarnDisclaimer } from './WarnDisclaimer';
import { REOWN_SKIP_CONFIRMATION_MODAL } from '../../config';
import { commonStyles } from './theme';

/**
 * Common confirmation modal component for Reown requests
 *
 * @param {Object} props - Component props
 * @param {Function} props.onDismiss - Function to call when modal is dismissed
 * @param {Object} props.data - Request data to pass to the detailed screen
 * @param {string} props.title - Modal title
 * @param {string} props.message - Modal message (will be wrapped with standard text)
 * @param {string} props.reviewButtonText - Text for the review details button
 * @param {string} props.destinationScreen - Navigation destination screen name
 * @param {string} props.navigationParamName - Parameter name for the navigation data
 * @param {Function} props.onRejectAction - Optional custom reject action
 * @param {Function} props.onAcceptAction - Optional custom accept action
 * @param {string} props.retryingStateSelector - Redux selector path for retrying state
 * @returns {React.ReactElement}
 */
export const RequestConfirmationModal = ({
  onDismiss,
  data,
  title,
  message = t`You have received a new request. Please carefully review the details before deciding to accept or decline.`,
  reviewButtonText = t`Review details`,
  destinationScreen,
  navigationParamName = 'request',
  onRejectAction,
  onAcceptAction,
  retryingStateSelector,
}) => {
  // If retryingStateSelector is provided, check if retrying
  const isRetrying = retryingStateSelector
    ? useSelector((state) => {
      // Split the selector path and access nested properties
      const parts = retryingStateSelector.split('.');
      let result = state;
      for (const part of parts) {
        result = result?.[part];
      }
      return result || false;
    })
    : false;

  const navigation = useNavigation();
  const dispatch = useDispatch();

  const onModalDismiss = useCallback(() => {
    if (onRejectAction) {
      onRejectAction();
    } else {
      dispatch(reownReject());
    }
    onDismiss();
  }, [onDismiss, onRejectAction, dispatch]);

  const navigateToDetailScreen = () => {
    onDismiss();
    const params = {};
    params[navigationParamName] = data;

    // Add accept/reject callbacks if provided
    if (onAcceptAction) params.onAccept = onAcceptAction;
    if (onRejectAction) params.onReject = onRejectAction;

    navigation.navigate(destinationScreen, params);
  };

  useEffect(() => {
    if (REOWN_SKIP_CONFIRMATION_MODAL || isRetrying) {
      navigateToDetailScreen();
    }
  }, [isRetrying]);

  return (
    <ModalBase show onDismiss={onModalDismiss}>
      <ModalBase.Title>{title}</ModalBase.Title>
      <ModalBase.Body style={commonStyles.body}>
        <WarnDisclaimer />
        <Text style={commonStyles.text}>
          {message}
        </Text>
      </ModalBase.Body>
      <ModalBase.Button
        title={reviewButtonText}
        onPress={navigateToDetailScreen}
      />
      <ModalBase.DiscreteButton
        title={t`Cancel`}
        onPress={onModalDismiss}
      />
    </ModalBase>
  );
};

export default RequestConfirmationModal;
