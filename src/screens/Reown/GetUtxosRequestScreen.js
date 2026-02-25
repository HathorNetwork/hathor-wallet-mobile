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
import { GetUtxosRequest } from '../../components/Reown/GetUtxosRequest';
import { RequestWrapper } from '../../components/Reown/theme';

export function GetUtxosRequestScreen({ route }) {
  const { getUtxosRequest } = route.params;

  return (
    <RequestWrapper>
      <HathorHeader
        title={t`UTXOs Request`.toUpperCase()}
      />
      <GetUtxosRequest getUtxosRequest={getUtxosRequest} />
      <OfflineBar />
    </RequestWrapper>
  );
}
