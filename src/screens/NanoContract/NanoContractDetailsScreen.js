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
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import HathorHeader from '../../components/HathorHeader';
import { NanoContractDetails } from '../../components/NanoContract/NanoContractDetails.component';
import OfflineBar from '../../components/OfflineBar';
import { COLORS } from '../../styles/themes';

/**
 * Presents a list of Nano Contract transactions.
 */
export function NanoContractDetailsScreen({ navigation, route }) {
  /* Without this default the app breaks after the current Nano Contract unregistration.
   * By having a default value the app can render the screen normally after unregistration
   * and let it step aside while coming back to Dashboard screen. This transition happens
   * quickly, therefore the user will not have time to see the default state.
   */
  const defaultNc = { ncId: '', address: '' };
  const { ncId } = route.params;
  const nc = useSelector((state) => state.nanoContract.registered[ncId]) || defaultNc;
  return (
    <Wrapper>
      <HathorHeader
        title={t`Nano Contract Details`.toUpperCase()}
        onBackPress={() => navigation.goBack()}
      />
      <NanoContractDetails nc={nc} />
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
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
});
