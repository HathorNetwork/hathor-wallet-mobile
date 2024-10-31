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
import { NanoContractTransactionHeader } from '../../components/NanoContract/NanoContractTransactionHeader';
import { NanoContractTransactionActionList } from '../../components/NanoContract/NanoContractTransactionActionList';
import OfflineBar from '../../components/OfflineBar';
import { COLORS } from '../../styles/themes';

/**
 * It presents information about the transaction.
 */
export function NanoContractTransactionScreen({ navigation, route }) {
  const { tx } = route.params;
  return (
    <Wrapper>
      <NavigationHeader navigation={navigation} />
      <ContentWrapper>
        <NanoContractTransactionHeader tx={tx} />
        <NanoContractTransactionActionList tx={tx} />
      </ContentWrapper>
      <OfflineBar />
    </Wrapper>
  );
}

const NavigationHeader = ({ navigation }) => (
  <HathorHeader
    title={t`Nano Contract Transaction`.toUpperCase()}
    onBackPress={() => navigation.goBack()}
  />
);

const Wrapper = ({ children }) => (
  <View style={styles.wrapper}>
    {children}
  </View>
);

const ContentWrapper = ({ children }) => (
  <View style={styles.wrapper}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
});
