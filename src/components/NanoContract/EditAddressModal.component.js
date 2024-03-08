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
} from 'react-native';
import { t } from 'ttag';

import { SelectAddressModal } from './SelectAddressModal.component';
import { EditInfoContainer } from '../EditInfoContainer.component';
import { ModalBase } from '../ModalBase.component';
import { TextLabel } from '../TextLabel.component';
import { TextValue } from '../TextValue.component';

export const EditAddressModal = ({ address, show, onAddressChange, onDismiss }) => {
  const [selectedAddress, setSelectedAddress] = useState(address);
  const [showSelectAddressModal, setShowSelectAddressModal] = useState(false);
  const [saveDisabled, setSaveDisabled] = useState(true);

  const onEditAddress = () => {
    setShowSelectAddressModal(true);
  };

  const toggleSelectAddressModal = () => {
    setShowSelectAddressModal(!showSelectAddressModal);
  };

  const onSelectAddress = (address) => {
    toggleSelectAddressModal();
    setSelectedAddress(address);
    setSaveDisabled(false);
  };

  return (
    <ModalBase show={show} onDismiss={onDismiss} >
      <ModalBase.Title>{t`Edit Nano Contract Address`}</ModalBase.Title>
      <ModalBase.Body style={styles.body}>
        <FieldContainer>
          <EditInfoContainer onPress={onEditAddress}>
            <TextLabel pb8 bold>{t`Address`}</TextLabel>
            <TextValue>{selectedAddress}</TextValue>
          </EditInfoContainer>
        </FieldContainer>
        <SelectAddressModal
          show={showSelectAddressModal}
          onDismiss={toggleSelectAddressModal}
          onSelectAddress={onSelectAddress}
        />
      </ModalBase.Body>
      <ModalBase.Button
        title={t`Save`}
        disabled={saveDisabled}
        onPress={() => onAddressChange(selectedAddress)}
      />
    </ModalBase>
  );
};

const FieldContainer = ({ children }) => (
  <View style={styles.fieldContainer}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  body: {
    paddingBottom: 20,
  },
  fieldContainer: {
    width: '100%',
    padding: 6,
  },
});
