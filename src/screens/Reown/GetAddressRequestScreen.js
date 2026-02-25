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
import { GetAddressRequest } from '../../components/Reown/GetAddressRequest';
import { RequestWrapper } from '../../components/Reown/theme';

export function GetAddressRequestScreen({ route }) {
  const { getAddressRequest } = route.params;

  return (
    <RequestWrapper>
      <HathorHeader
        title={t`Address Request`.toUpperCase()}
      />
      <GetAddressRequest getAddressRequest={getAddressRequest} />
      <OfflineBar />
    </RequestWrapper>
  );
}
