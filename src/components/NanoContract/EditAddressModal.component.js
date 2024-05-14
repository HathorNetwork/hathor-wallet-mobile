/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { t } from 'ttag';
import { COLORS } from '../../styles/themes';
import { CircleInfoIcon } from '../Icons/CircleInfo.icon';
import { ModalBase } from '../ModalBase';
import { TextLabel } from '../TextLabel';
import { TextValue } from '../TextValue';

/**
 * Use this modal to edit an address.
 *
 * @param {Object} props
 * @param {string} props.item It refers to the address selected
 * @param {boolean} props.show It determines if modal must show or hide
 * @param {(address:string) => {}} props.onAddressChange
 * Function called when an address is selected
 * @param {() => {}} props.onDismiss
 * Function called to dismiss the modal on user's interaction
 *
 * @example
 * <EditAddressModal
 *   show={showEditAddressModal}
 *   item={selectedAddress}
 *   onDismiss={onDismissEditAddressModal}
 *   onAddressChange={handleAddressChange}
 * />
 */
export const EditAddressModal = ({ item, show, onAddressChange, onDismiss }) => {
  const [selectedItem] = useState(item);

  return (
    <ModalBase show={show} onDismiss={onDismiss}>
      <ModalBase.Title>{t`New Nano Contract Address`}</ModalBase.Title>
      <ModalBase.Body style={styles.body}>
        <View style={styles.infoContainer}>
          <View style={styles.infoIcon}>
            <CircleInfoIcon size={20} color='hsla(203, 100%, 25%, 1)' />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.text}>
              {t`This address signs any transactions you created with Nano Contracts method. Switching to a new one means`}
              <Text style={styles.bold}>
                {' '}{t`all future transactions will use this address.`}
              </Text>
            </Text>
          </View>
        </View>
        <View style={styles.selectionContainer}>
          <Text style={[styles.text, styles.bold, styles.pd8]}>{t`Selected Information`}</Text>
          <FieldContainer>
            <TextLabel pb8 bold>{t`Address`}</TextLabel>
            <TextValue>{selectedItem.address}</TextValue>
          </FieldContainer>
          <FieldContainer last>
            <TextLabel pb8 bold>{t`Index`}</TextLabel>
            <TextValue>{selectedItem.index}</TextValue>
          </FieldContainer>
        </View>
      </ModalBase.Body>
      <ModalBase.Button
        title={t`Confirm new address`}
        onPress={() => onAddressChange(selectedItem.address)}
      />
      <ModalBase.DiscreteButton
        title={t`Go back`}
        onPress={onDismiss}
      />
    </ModalBase>
  );
};

/**
 * Container for label and value pair components.
 *
 * @param {Object} props
 * @param {object} props.last It determines bottom padding application.
 * @param {object} props.children
 */
const FieldContainer = ({ last, children }) => (
  <View style={[styles.fieldContainer, last && styles.pd0]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  pd0: {
    paddingBottom: 0,
  },
  pd8: {
    paddingBottom: 8,
  },
  body: {
    paddingBottom: 20,
  },
  fieldContainer: {
    width: '100%',
    paddingBottom: 4,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
  },
  infoContainer: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'hsla(203, 100%, 93%, 1)',
  },
  infoContent: {
    paddingLeft: 8,
  },
  selectionContainer: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.freeze100,
  },
});
