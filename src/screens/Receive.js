/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { View } from 'react-native';
import { t } from 'ttag';

import HathorHeader from '../components/HathorHeader';
import ReceiveMyAddress from '../components/ReceiveMyAddress';
import OfflineBar from '../components/OfflineBar';

const ReceiveScreen = ({ navigation }) => (
  <View style={{ flex: 1 }}>
    <HathorHeader
      title={t`RECEIVE`}
      withBorder
    />
    <ReceiveMyAddress navigation={navigation} />
    <OfflineBar />
  </View>
);

export default ReceiveScreen;
