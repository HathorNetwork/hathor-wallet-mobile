/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import RequestConfirmationModal from './RequestConfirmationModal';
import { SCREEN_NAME } from '../../screens/Reown/SendTransactionRequestScreen';

export default ({
  onDismiss,
  data,
  onAcceptAction,
  onRejectAction,
}) => (
  <RequestConfirmationModal
    onDismiss={onDismiss}
    data={data}
    title={t`Transaction Request`}
    message={t`You have received a new transaction request. Please carefully review the details before deciding to accept or decline.`}
    reviewButtonText={t`Review transaction details`}
    destinationScreen={SCREEN_NAME}
    navigationParamName='sendTransactionRequest'
    onAcceptAction={onAcceptAction}
    onRejectAction={onRejectAction}
    retryingStateSelector='reown.sendTransaction.retrying'
  />
);
