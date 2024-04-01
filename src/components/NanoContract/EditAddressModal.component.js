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
import { CircleInfoIcon } from '../Icon/CircleInfo.icon';

import { ModalBase } from '../ModalBase.component';
import { TextLabel } from '../TextLabel.component';
import { TextValue } from '../TextValue.component';

export const EditAddressModal = ({ item, show, onAddressChange, onDismiss }) => {
  const [selectedItem, _] = useState(item);

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
