/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import RequestConfirmationModal from '../RequestConfirmationModal';

export const NewNanoContractTransactionModal = ({
  onDismiss,
  data,
}) => (
  <RequestConfirmationModal
    onDismiss={onDismiss}
    data={data}
    title={t`New Nano Contract Transaction`}
    message={t`You have received a new Nano Contract Transaction. Please carefully review the details before deciding to accept or decline.`}
    reviewButtonText={t`Review transaction details`}
    destinationScreen='NewNanoContractTransactionScreen'
    navigationParamName='ncTxRequest'
    retryingStateSelector='reown.newNanoContractTransaction.retrying'
  />
);
