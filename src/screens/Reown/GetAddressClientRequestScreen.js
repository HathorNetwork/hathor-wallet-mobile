/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { t } from 'ttag';
import HathorHeader from '../../components/HathorHeader';
import OfflineBar from '../../components/OfflineBar';
import { GetAddressClientRequest } from '../../components/Reown/GetAddressClientRequest';
import { COLORS } from '../../styles/themes';

export function GetAddressClientRequestScreen({ route }) {
  const { getAddressClientRequest } = route.params;

  return (
    <Wrapper>
      <HathorHeader
        title={t`Select Address`.toUpperCase()}
      />
      <GetAddressClientRequest getAddressClientRequest={getAddressClientRequest} />
      <OfflineBar />
    </Wrapper>
  );
}

const Wrapper = ({ children }) => (
  <View style={styles.wrapper}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.lowContrastDetail,
  },
});
