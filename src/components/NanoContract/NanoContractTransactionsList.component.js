/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { NanoContractTransactionsListHeader } from './NanoContractTransactionsListHeader.component';
import { NanoContractTransactionsListItem } from './NanoContractTransactionsListItem.component';
import { COLORS } from '../../styles/themes';
import { nanoContractAddressChangeRequest } from '../../actions';
import { HathorFlatList } from '../HathorFlatList.component';

const getNanoContractHistory = (ncId) => (state) => {
  const history = state.nanoContract.contractsHistory[ncId];
  if (history) {
    return Object.values(history);
  }
  /* This situation is unlikely to happen */
  return [];
}

export const NanoContractTransactionsList = ({ nc }) => {
  const ncHistory = useSelector(getNanoContractHistory(nc.ncId));

  const dispatch = useDispatch();
  const [ncAddress, changeNcAddress] = useState(nc.address);
  const navigation = useNavigation();

  const onAddressChange = (address) => {
    changeNcAddress(address);
    dispatch(nanoContractAddressChangeRequest({ newAddress: address, oldNc: nc }));
  }

  const navigatesToNanoContractTransaction = (tx) => {
    navigation.navigate('NanoContractTransaction', { tx });
  };

  return (
    <Wrapper>
      <NanoContractTransactionsListHeader
        nc={nc}
        address={ncAddress}
        onAddressChange={onAddressChange}
      />
      <HathorFlatList
        data={ncHistory}
        renderItem={({ item, index }) => (
          <NanoContractTransactionsListItem
            item={item}
            index={index}
            onPress={() => navigatesToNanoContractTransaction(item)}
          />
        )}
        keyExtractor={(item) => item.txId}
      />
    </Wrapper>
  );
};

const Wrapper = ({ children }) => (
  <View style={styles.wrapper}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
});
