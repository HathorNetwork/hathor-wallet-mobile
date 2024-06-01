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
  Text,
} from 'react-native';
import { t } from 'ttag';
import { useSelector } from 'react-redux';
import { COLORS } from '../../styles/themes';
import { ModalBase } from '../ModalBase';
import { TextValue } from '../TextValue';
import { TextLabel } from '../TextLabel';
import { EditAddressModal } from './EditAddressModal.component';
import { consumeAsyncIterator } from '../../utils';

/**
 * Use this modal to select an address from the wallet.
 *
 * @param {Object} props
 * @param {string} props.address It refers to the address selected
 * @param {boolean} props.show It determines if modal must show or hide
 * @param {(address:string) => {}} props.onSelectAddress
 * Callback function called when an address is selected
 * @param {() => {}} props.onDismiss
 * Callback function called to dismiss the modal
 *
 * @example
 * <SelectAddressModal
 *   address={selectedAddress}
 *   show={showSelectAddressModal}
 *   onDismiss={toggleSelectAddressModal}
 *   onSelectAddress={handleSelectAddress}
 * />
 */
export const SelectAddressModal = ({ address, show, onSelectAddress, onDismiss }) => {
  const wallet = useSelector((state) => state.wallet);
  const [addresses, setAddresses] = useState([]);
  const [selectedItem, setSelectedItem] = useState({ address });
  const [showEditAddressModal, setShowEditAddressModal] = useState(false);

  const toggleEditAddressModal = () => {
    setShowEditAddressModal(!showEditAddressModal);
  };

  const onDismissEditAddressModal = () => {
    setSelectedItem({ address });
    toggleEditAddressModal();
  };

  const onSelectItem = (item) => {
    setSelectedItem(item);
    toggleEditAddressModal();
  };

  const hookAddressChange = (selectedAddress) => {
    toggleEditAddressModal();
    onSelectAddress(selectedAddress);
  };

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
        <View style={styles.bodyWrapper}>
          <View style={styles.infoWrapper}>
            <Text style={[styles.infoText, styles.textBold]}>{t`Current Information`}</Text>
            <Text style={styles.infoText}>{t`To change, select other address on the list below.`}</Text>
            <Text style={styles.infoText}>
              <Text style={styles.textBold}>{t`Address`}: </Text>
              <Text>{address}</Text>
            </Text>
          </View>
          <FlatList
            data={addresses}
            renderItem={({ item }) => (
              <AddressItem currentAddress={address} item={item} onSelectItem={onSelectItem} />
            )}
            keyExtractor={(item) => item.address}
          />
        </View>
        {showEditAddressModal
          && (
          <EditAddressModal
            show={showEditAddressModal}
            item={selectedItem}
            onDismiss={onDismissEditAddressModal}
            onAddressChange={hookAddressChange}
          />
          )}
      </ModalBase.Body>
    </ModalBase>
  );
};

/**
 * It renders and address as an item of the list, also it indicates a match
 * between the current address and the item's address.
 *
 * @param {Object} props
 * @param {string} props.currentAddress It refers to the address selected
 * @param {Object} props.item Address of the item
 * @param {string} props.item.address
 * @param {number} props.item.index
 * @param {(address:string) => void} props.onSelectItem
 * Callback function called when an address is selected
 */
const AddressItem = ({ currentAddress, item, onSelectItem }) => (
  <TouchableHighlight
    onPress={() => onSelectItem(item)}
    underlayColor={COLORS.primaryOpacity30}
  >
    <View
      style={[
        addressItemStyle.wrapper,
        currentAddress === item.address && addressItemStyle.selected
      ]}
    >
      <View>
        <TextValue>{item.address}</TextValue>
        <TextLabel>{t`index`} {item.index}</TextLabel>
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
    height: '90%',
  },
  body: {
    flex: 1,
    paddingBottom: 20,
  },
  bodyWrapper: {
    flex: 1,
  },
  infoWrapper: {
    borderRadius: 8,
    backgroundColor: COLORS.freeze100,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.black,
    paddingBottom: 8,
  },
  textBold: {
    fontWeight: 'bold',
  },
});

const addressItemStyle = StyleSheet.create({
  wrapper: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selected: {
    backgroundColor: COLORS.freeze100,
  },
});
