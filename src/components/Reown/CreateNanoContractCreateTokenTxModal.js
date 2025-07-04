/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import RequestConfirmationModal from './RequestConfirmationModal';

export const CreateNanoContractCreateTokenTxModal = ({
  onDismiss,
  data,
  accept,
  deny,
}) => (
  <RequestConfirmationModal
    onDismiss={onDismiss}
    data={data}
    title={t`Create Nano Contract Create Token Request`}
    message={t`You have received a new Create Nano Contract Create Token Request. Please carefully review the details before deciding to accept or decline.`}
    reviewButtonText={t`Review request details`}
    destinationScreen='CreateNanoContractCreateTokenTxRequest'
    navigationParamName='createNanoContractCreateTokenTxRequest'
    onAcceptAction={accept}
    onRejectAction={deny}
    retryingStateSelector='reown.createNanoContractCreateTokenTx.retrying'
  />
);

export default CreateNanoContractCreateTokenTxModal;
