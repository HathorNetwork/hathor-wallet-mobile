/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import HathorHeader from '../../components/HathorHeader';
import OfflineBar from '../../components/OfflineBar';
import { GetAddressClientRequest } from '../../components/Reown/GetAddressClientRequest';
import { RequestWrapper } from '../../components/Reown/theme';

export function GetAddressClientRequestScreen({ route }) {
  const { getAddressClientRequest } = route.params;

  return (
    <RequestWrapper>
      <HathorHeader
        title={t`Select Address`.toUpperCase()}
      />
      <GetAddressClientRequest getAddressClientRequest={getAddressClientRequest} />
      <OfflineBar />
    </RequestWrapper>
  );
}
