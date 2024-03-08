/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TouchableHighlight,
} from 'react-native';
import { t } from 'ttag';

import { ModalBase } from '../ModalBase.component';
import { TextValue } from '../TextValue.component';
import { COLORS } from '../../styles/themes';
import { useSelector } from 'react-redux';
import { TextLabel } from '../TextLabel.component';

const consumeAsyncIterator = async (asyncIterator) => {
  const list = [];
  for (;;) {
    const objYielded = await asyncIterator.next();
    const { value, done } = objYielded;

    if (done) {
      break;
    }

    list.push(value);
  }
  return [...list];
};

export const SelectAddressModal = ({ show, onDismiss, onSelectAddress }) => {
  const wallet = useSelector((state) => state.wallet);
  const [addresses, setAddresses] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const iterator = await wallet.getAllAddresses();
      const allAddresses = await consumeAsyncIterator(iterator);
      setAddresses(allAddresses);
    };
    fetchData();
  }, []);

  return (
    <ModalBase
      show={show}
      onDismiss={onDismiss}
      styleModal={styles.modal}
      styleWrapper={styles.wrapper}
    >
      <ModalBase.Title>{t`Choose New Wallet Address`}</ModalBase.Title>
      <ModalBase.Body style={styles.body}>
        <FlatList
          data={addresses}
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
        <TextLabel>{item.index}</TextLabel>
        <TextValue>{item.address}</TextValue>
      </View>
    </View>
  </TouchableHighlight>
);

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    marginHorizontal: 0,
  },
  wrapper: {
    height: '80%',
    paddingBottom: 56,
  },
  body: {
    paddingBottom: 20,
  },
});

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
