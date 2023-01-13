import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { pushCleanTxDetails } from '../actions';
import TxDetailsModal from './TxDetailsModal';

export default function ShowPushNotificationTxDetails() {
  const txDetails = useSelector((state) => state.pushNotification.txDetails);
  const dispatch = useDispatch();

  if (!txDetails) return null;
  return (
    <TxDetailsModal
      tx={txDetails.tx}
      token={txDetails.token}
      onRequestClose={() => dispatch(pushCleanTxDetails())}
      isNFT={false}
    />
  );
}
