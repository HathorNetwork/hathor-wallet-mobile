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
  TouchableHighlight,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import { NanoContractTransactionsListItem } from '../../components/NanoContract/NanoContractTransactionsListItem.component';
import { formatNanoContractRegistryEntry } from '../../sagas/nanoContract';
import { COLORS } from '../../styles/themes';
import { EditInfoContainer } from '../EditInfoContainer.component';
import { ModalBase } from '../ModalBase.component';
import { TextLabel } from '../TextLabel.component';
import { TextValue } from '../TextValue.component';
import { NanoContractTransactionsListHeader } from './NanoContractTransactionsListHeader.component';

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
  const [showEditAddressModal, setShowEditAddressModal] = useState(false);
  const [showSelectAddressModal, setShowSelectAddressModal] = useState(false);
  const ncHistory = useSelector(getNanoContractHistory(ncKey));
  const navigation = useNavigation();

  const navigatesToNanoContractTransaction = (tx) => {
    navigation.navigate('NanoContractTransaction', { tx });
  };

  const onEditAddress = () => {
    setShowEditAddressModal(true);
  }

  const toggleEditAddressModal = () => {
    setShowEditAddressModal(!showEditAddressModal);
  };

  const onChangeAddress = () => {
    // TODO: Fix this mechanism, it is not good yet
    setShowSelectAddressModal(true);
  };

  const toggleSelectAddressModal = () => {
    setShowSelectAddressModal(!showSelectAddressModal);
  };

  const onSelectAddress = (address) => {
    changeAddress(address);
    toggleSelectAddressModal();
  };

  return (
    <Wrapper>
      <NanoContractTransactionsListHeader
        nc={nc}
        address={ncAddress}
        onEditAddress={onEditAddress}
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
      <EditAddressModal
        show={showEditAddressModal}
        address={ncAddress}
        onDismiss={toggleEditAddressModal}
        onChangeAddress={onChangeAddress}
      />
      <SelectAddressModal
        show={showSelectAddressModal}
        onDismiss={toggleSelectAddressModal}
        onSelectAddress={onSelectAddress}
      />
    </Wrapper>
  );
};

const EditAddressModal = ({ show, onDismiss, address, onChangeAddress }) => (
  <ModalBase show={show} onDismiss={onDismiss} >
    <ModalBase.Title>{t`Edit Nano Contract Address`}</ModalBase.Title>
    <ModalBase.Body style={modalStyles.body}>
      <FieldContainer>
        <EditInfoContainer onPress={onChangeAddress}>
          <TextLabel pb8 bold>{t`Address`}</TextLabel>
          <TextValue>{address}</TextValue>
        </EditInfoContainer>
      </FieldContainer>
    </ModalBase.Body>
    <ModalBase.Button title={t`Save`} disabled />
  </ModalBase>
);

const FieldContainer = ({ children }) => (
  <View style={modalStyles.fieldContainer}>
    {children}
  </View>
);

const modalStyles = StyleSheet.create({
  body: {
    paddingBottom: 20,
  },
  fieldContainer: {
    padding: 6,
  },
});

const SelectAddressModal = ({ show, onDismiss, onSelectAddress }) => {
  const usedAddresses = () => ([
    { address: 'abc' },
    { address: 'def' },
  ]);
  return (
    <ModalBase
      show={show}
      onDismiss={onDismiss}
    >
      <ModalBase.Title>{t`Choose New Wallet Address`}</ModalBase.Title>
      <ModalBase.Body style={modalStyles.body}>
        <FlatList
          data={usedAddresses()}
          renderItem={({item}) => (<AddressItem item={item} onSelect={onSelectAddress} />)}
          keyExtractor={(item) => item.address}
        />
      </ModalBase.Body>
    </ModalBase>
  );
};

const AddressItem = ({ item, onSelect }) => (
  <TouchableHighlight
    onPress={() => onSelect(item.address)}
    underlayColor={COLORS.primaryOpacity30}
  >
    <View style={addressItemStyle.wrapper}>
      <View>
        <TextValue>{item.address}</TextValue>
      </View>
    </View>
  </TouchableHighlight>
);

const addressItemStyle = StyleSheet.create({
  wrapper: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: COLORS.borderColor,
  },
});

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
