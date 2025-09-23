/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import {
  Image,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import ModalButton from './ModalButton';
import { COLORS } from '../../styles/themes';
import BackdropModal from '../BackdropModal';

const modalStyle = StyleSheet.create({
  signMessageText: {
    backgroundColor: COLORS.textColorShadowLighter,
    width: '100%',
    height: 100,
    borderRadius: 15,
    padding: 8,
    marginBottom: 12,
    marginTop: 12,
  },
});

export default ({
  headerText,
  body,
  onAccept,
  onReject,
  data,
  baseStyles,
  onDismiss,
}) => {
  const styles = { ...baseStyles, modalStyle };
  const {
    icon,
    proposer,
    url,
  } = data;

  return (
    <BackdropModal
      visible
      animationType='fade'
      position='center'
      enableSwipeToDismiss={false}
      enableBackdropPress={false}
      onDismiss={onDismiss}
      contentStyle={styles.modalBox}
    >
      <Image style={styles.modalImage} source={{ uri: icon }} />
      <Text style={styles.modalUrl} numberOfLines={2} ellipsizeMode="middle">
        {url}
      </Text>
      <Text style={styles.modalProposer} numberOfLines={3} ellipsizeMode="tail">
        {proposer}
      </Text>
      <Text style={styles.modalHeader}>
        { headerText }
      </Text>
      { body }
      <View style={styles.buttonContainer}>
        <ModalButton title={t`Reject`} onPress={onReject} />
        <ModalButton highlight title={t`Approve`} onPress={onAccept} />
      </View>
    </BackdropModal>
  );
};
