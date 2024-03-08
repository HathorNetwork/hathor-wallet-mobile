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

  useEffect(async () => {
    const iterator = await wallet.getAllAddresses();
    const allAddresses = await consumeAsyncIterator(iterator);
    setAddresses(allAddresses);
  }, []);

  return (
    <ModalBase
      show={show}
      onDismiss={onDismiss}
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
        <TextValue>{item.address}</TextValue>
      </View>
    </View>
  </TouchableHighlight>
);

const styles = StyleSheet.create({
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
