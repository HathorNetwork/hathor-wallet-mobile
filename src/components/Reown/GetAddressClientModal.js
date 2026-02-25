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
    title={t`Select Address Request`}
    message={t`An app is requesting you to share an address from your wallet. Please select an address to share.`}
    reviewButtonText={t`Select Address`}
    destinationScreen='GetAddressClientRequest'
    navigationParamName='getAddressClientRequest'
  />
);
