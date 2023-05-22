
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

const modalStyle = StyleSheet.create({});

export default ({
  onAcceptAction,
  onRejectAction,
  onDismiss,
  data,
  baseStyles,
}) => {
  const styles = { ...baseStyles, modalStyle };
  const dispatch = useDispatch();

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
      headerText={t`Connect to this dApp?`}
      body={(
        <Text style={styles.modalText}>
          { t`By clicking connect, you allow this dapp to receive your wallet's public address. Please validate the URL and the dApp name, this is an important security step to protect your data from potential phishing risks.` }
        </Text>
      )}
      onAccept={onAccept}
      onReject={onReject}
      data={data}
      baseStyles={styles}
    />
  );
};
