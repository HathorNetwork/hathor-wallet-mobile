/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';
import { pushCleanTxDetails, pushTxDetailsRequested } from '../actions';
import ActionModal from './ActionModal';
import PushTxDetailsModal from './PushTxDetailsModal';

const txNotFoundTitle = t`Transation not found`;
const txNotFoundBody = t`The transaction has not arrived yet in your wallet. Do you want to retry?`;
const txNotFoundButton = t`Retry`;

export default function ShowPushNotificationTxDetails() {
  const navigation = useNavigation();
  const txDetails = useSelector((state) => state.pushNotification.txDetails);
  const dispatch = useDispatch();

  if (!txDetails) {
    return null;
  }

  const { isTxFound, txId } = txDetails;

  const onRetry = () => {
    dispatch(pushCleanTxDetails());
    dispatch(pushTxDetailsRequested({ txId }));
  };

  const renderPushTxDetailsModal = () => (
    <PushTxDetailsModal
      navigation={navigation}
      tx={txDetails.tx}
      tokens={txDetails.tokens}
      onRequestClose={() => dispatch(pushCleanTxDetails())}
    />
  );

  const renderRetryModal = () => (
    <ActionModal
      title={txNotFoundTitle}
      text={txNotFoundBody}
      button={txNotFoundButton}
      onAction={() => onRetry()}
      onDismiss={() => dispatch(pushCleanTxDetails())}
    />
  );

  const renderSelector = () => {
    if (isTxFound) {
      return renderPushTxDetailsModal();
    }
    return renderRetryModal();
  };

  return renderSelector();
}
