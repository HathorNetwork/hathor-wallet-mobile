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
import { useSelector } from 'react-redux';

import { SelectAddressModal } from './SelectAddressModal.component';
import { EditAddressModal } from './EditAddressModal.component';
import { NanoContractTransactionsListHeader } from './NanoContractTransactionsListHeader.component';
import { NanoContractTransactionsListItem } from '../../components/NanoContract/NanoContractTransactionsListItem.component';
import { formatNanoContractRegistryEntry } from '../../sagas/nanoContract';
import { COLORS } from '../../styles/themes';

const getNanoContractHistory = (ncKey) => (state) => {
  // const history = state.nanoContract.contractHistory[ncKey];
  // return Object.values(history);
  return [
    {
      txId: "000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fce",
      timestamp: 1708356261,
      tokens: [
        "00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d",
        "0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7"
      ],
      isVoided: false,
      ncId: "000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a",
      ncMethod: "swap",
      callerOrigin: 'mine',
    },
    {
      txId: "000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fcd",
      timestamp: 1708356261,
      tokens: [
        "00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d",
        "0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7"
      ],
      isVoided: false,
      ncId: "000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a",
      ncMethod: "swap",
      callerOrigin: 'oracle',
    },
    {
      txId: "000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fcc",
      timestamp: 1708356261,
      tokens: [
        "00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d",
        "0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7"
      ],
      isVoided: false,
      ncId: "000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a",
      ncMethod: "swap",
      callerOrigin: 'wallet',
    },
    {
      txId: "000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fcb",
      timestamp: 1708356261,
      tokens: [
        "00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d",
        "0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7"
      ],
      isVoided: false,
      ncId: "000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a",
      ncMethod: "swap",
      callerOrigin: 'other',
    },
    {
      txId: "000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fca",
      timestamp: 1708356261,
      tokens: [
        "00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d",
        "0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7"
      ],
      isVoided: true,
      ncId: "000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a",
      ncMethod: "swap",
      callerOrigin: 'other',
    },
  ].filter((tx) => tx.isVoided === false);
}

export const NanoContractTransactionsList = ({ nc }) => {
  const ncKey = formatNanoContractRegistryEntry(nc.address, nc.ncId);
  const [ncAddress, changeAddress] = useState(nc.address);
  const ncHistory = useSelector(getNanoContractHistory(ncKey));
  const navigation = useNavigation();

  const navigatesToNanoContractTransaction = (tx) => {
    navigation.navigate('NanoContractTransaction', { tx });
  };

  return (
    <Wrapper>
      <NanoContractTransactionsListHeader
        nc={nc}
        address={ncAddress}
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
