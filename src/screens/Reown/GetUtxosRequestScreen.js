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
import { GetUtxosRequest } from '../../components/Reown/GetUtxosRequest';
import { COLORS } from '../../styles/themes';

export function GetUtxosRequestScreen({ route }) {
  const { getUtxosRequest } = route.params;

  return (
    <Wrapper>
      <HathorHeader
        title={t`UTXOs Request`.toUpperCase()}
      />
      <GetUtxosRequest getUtxosRequest={getUtxosRequest} />
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
