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

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.textColorShadow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    alignSelf: 'center',
    width: '85%',
    maxWidth: 300,
  },
  modalImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 10,
  },
  modalUrl: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalProposer: {
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalHeader: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 12,
    marginBottom: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ({
  onAcceptAction,
  onRejectAction,
  onDismiss,
  data,
}) => {
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
