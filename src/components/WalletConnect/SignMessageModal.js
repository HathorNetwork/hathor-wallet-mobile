/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';
import { StyleSheet, Text } from 'react-native';
import ApproveRejectModal from './ApproveRejectModal';
import { COLORS } from '../../styles/themes';

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
  onAcceptAction,
  onRejectAction,
  onDismiss,
  data,
  baseStyles,
}) => {
  const styles = { ...baseStyles, modalStyle };
  const dispatch = useDispatch();
  const { message, } = data;

  const onAccept = () => {
    onDismiss();
    dispatch(onAcceptAction);
  };

  const onReject = () => {
    onDismiss();
    dispatch(onRejectAction);
  };

  return (
    <ApproveRejectModal
      headerText={t`Sign this message?`}
      body={(
        <>
          <Text style={styles.signMessageText}>
            { message }
          </Text>
          <Text style={styles.modalText}>
            { t`By clicking approve, you will sign the requested message using the first address derived from your root key on the m/44'/280'/0'/0/0 derivation path.` }
          </Text>
        </>
      )}
      onAccept={onAccept}
      onReject={onReject}
      data={data}
      baseStyles={styles}
    />
  );
};
