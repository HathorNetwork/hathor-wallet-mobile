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
import { NanoContractTransactionsListItem } from '../../components/NanoContract/NanoContractTransactionsListItem.component';
import { formatNanoContractRegistryEntry } from '../../sagas/nanoContract';
import { COLORS } from '../../styles/themes';
import { nanoContractAddressChangeRequest } from '../../actions';

const getNanoContractHistory = (ncKey) => (state) => {
  // const history = state.nanoContract.contractHistory[ncKey];
  // return Object.values(history);
  return [
    {
      tx_id: "0000024c0720b64421b8ae7915c24b77291f0d70b78746035b0c98669bf2bd49",
      txId: "0000024c0720b64421b8ae7915c24b77291f0d70b78746035b0c98669bf2bd49",
      version: 4,
      weight: 21.937001914291383,
      timestamp: 1709651014,
      is_voided: false,
      isVoided: false,
      inputs: [
        {
          value: 89100,
          token_data: 1,
          script: "dqkUUsHGkfofqIoaBi7hbSTJ1pq9TCqIrA==",
          decoded: {
            type: "P2PKH",
            address: "WWDcRRin3Wej7Es1KGmqqVV6RFyyH3x2DQ",
            timelock: null
          },
          token: "0000046a7350a07e3985dfbb797fb374706cc7daaf8994765c2ef488730a88fd",
          tx_id: "000002e1a1a438ea18d2b5bcbddffd549603db8aaddf7ee9f93372de12ea2fce",
          index: 0
        }
      ],
      outputs: [
        {
          value: 88800,
          token_data: 1,
          script: "dqkUztu0u/2LY202REnRkKZ0NwdDKzKIrA==",
          decoded: {
            type: "P2PKH",
            address: "WhXoGtGmissCdtTx7ZuCXphZR8ak4JwyVp",
            timelock: null
          },
          token: "0000046a7350a07e3985dfbb797fb374706cc7daaf8994765c2ef488730a88fd",
          spent_by: null
        },
        {
          value: 300,
          token_data: 2,
          script: "dqkUztu0u/2LY202REnRkKZ0NwdDKzKIrA==",
          decoded: {
            type: "P2PKH",
            address: "WhXoGtGmissCdtTx7ZuCXphZR8ak4JwyVp",
            timelock: null
          },
          token: "0000000d8f20c7629acdba93f02172bbc7a96e68c27bdc78e03dfe79984d7654",
          spent_by: null
        }
      ],
      parents: [
        "000002e1a1a438ea18d2b5bcbddffd549603db8aaddf7ee9f93372de12ea2fce",
        "000000bb7f87575f4a81e71427727c6b56c9575b83d2a8bd2fd79858317f718f"
      ],
      tokens: [
        "0000000d8f20c7629acdba93f02172bbc7a96e68c27bdc78e03dfe79984d7654",
        "0000046a7350a07e3985dfbb797fb374706cc7daaf8994765c2ef488730a88fd"
      ],
      ncId: "000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a",
      ncMethod: "swap",
      callerOrigin: 'mine',
    },
  ].filter((tx) => tx.isVoided === false);
}

export const NanoContractTransactionsList = ({ nc }) => {
  const ncKey = formatNanoContractRegistryEntry(nc.address, nc.ncId);
  const ncHistory = useSelector(getNanoContractHistory(ncKey));

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
      <ListWrapper>
        <FlatList
          data={ncHistory}
          renderItem={({item, index}) => (
            <NanoContractTransactionsListItem
              item={item}
              index={index}
              onPress={() => navigatesToNanoContractTransaction(item)}
            />)}
          keyExtractor={(item) => item.txId}
        />
      </ListWrapper>
    </Wrapper>
  );
};

const Wrapper = ({ children }) => (
  <View style={styles.wrapper}>
    {children}
  </View>
);

const ListWrapper = ({ children }) => (
  <View style={[styles.listWrapper]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
  listWrapper: {
    alignSelf: 'stretch',
    flex: 1,
    marginTop: 16,
    backgroundColor: COLORS.backgroundColor,
    marginHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 4,
    shadowColor: COLORS.textColor,
    shadowOpacity: 0.08,
  },
});
