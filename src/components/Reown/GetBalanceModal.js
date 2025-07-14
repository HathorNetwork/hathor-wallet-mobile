/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import RequestConfirmationModal from './RequestConfirmationModal';

export default ({
  onDismiss,
  data,
}) => (
  <RequestConfirmationModal
    onDismiss={onDismiss}
    data={data}
    title={t`New Get Balance Request`}
    message={t`You have received a new Get Balance Request. Please carefully review the details before deciding to accept or decline.`}
    reviewButtonText={t`Review Get Balance Request details`}
    destinationScreen='GetBalanceRequest'
    navigationParamName='getBalanceRequest'
  />
);

