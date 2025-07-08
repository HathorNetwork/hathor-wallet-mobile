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
  Image,
} from 'react-native';
import { t } from 'ttag';
import { useDispatch, useSelector } from 'react-redux';
import { COLORS } from '../../styles/themes';
import { ModalBase } from '../ModalBase';
import { TextValue } from '../TextValue';
import { TextLabel } from '../TextLabel';
import { EditAddressModal } from './EditAddressModal';
import { FeedbackContent } from '../FeedbackContent';
import errorIcon from '../../assets/images/icErrorBig.png';
import { selectAddressAddressesRequest } from '../../actions';

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
 * @param {(item: Object) => {}} props.onEditAddress
 * Callback function called when an address item is selected for editing
 *
 * @example
 * <SelectAddressModal
 *   address={selectedAddress}
 *   show={showSelectAddressModal}
 *   onDismiss={toggleSelectAddressModal}
 *   onSelectAddress={handleSelectAddress}
 *   onEditAddress={handleEditAddress}
 * />
 */
export const SelectAddressModal = ({
  address,
  show,
  onDismiss,
  onEditAddress,
  modalStep,
  selectedItem,
  onDismissEdit,
  onAddressChange
}) => {
  const dispatch = useDispatch();
  const { addresses, error } = useSelector((state) => state.selectAddressModal);

  const onSelectItem = (item) => {
    onEditAddress(item);
  };

  useEffect(() => {
    dispatch(selectAddressAddressesRequest());
  }, []);

  const hasFailed = () => error;
  const isLoading = () => !error && addresses.length === 0;
  const hasLoaded = () => !error && addresses.length > 0;

  if (modalStep === 'edit') {
    return (
      <EditAddressModal
        show={show}
        item={selectedItem}
        onDismiss={onDismissEdit}
        onAddressChange={onAddressChange}
      />
    );
  }

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
          {hasFailed()
            && (
              <FeedbackContent
                icon={(<Image source={errorIcon} style={styles.feedbackContentIcon} resizeMode='contain' />)}
                title={t`Load Addresses Error`}
                message={error}
                offcard
              />
            )}
          {isLoading()
            && (
              <FeedbackContent
                title={t`Loading`}
                message={t`Loading wallet addresses.`}
                offcard
              />
            )}
          {hasLoaded()
            && (
              <>
                <View style={styles.infoWrapper}>
                  <Text style={[styles.infoText, styles.textBold]}>{t`Current Information`}</Text>
                  <Text style={styles.infoText}>{t`To change, select other address on the list below.`}</Text>
                  <Text>
                    <TextValue bold>{t`Address`}</TextValue>
                    <TextValue>{`:${'\u00A0'}${address}`}</TextValue>
                  </Text>
                </View>
                <FlatList
                  data={addresses}
                  renderItem={({ item }) => (
                    <AddressItem currentAddress={address} item={item} onSelectItem={onSelectItem} />
                  )}
                  keyExtractor={(item) => item.address}
                />
              </>
            )}
        </View>
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
const AddressItem = ({ currentAddress, item, onSelectItem }) => {
  const onPress = () => {
    if (currentAddress === item.address) {
      return;
    }
    onSelectItem(item);
  };
  return (
    <TouchableHighlight
      onPress={onPress}
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
  )
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  wrapper: {
    height: '90%',
    minHeight: 500,
  },
  body: {
    flex: 1,
    paddingBottom: 20,
    minHeight: 400,
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
  feedbackContentIcon: {
    height: 36,
    width: 36,
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
