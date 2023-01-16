import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { pushCleanTxDetails } from '../actions';
import PushTxDetailsModal from './PushTxDetailsModal';

export default function ShowPushNotificationTxDetails() {
  const txDetails = useSelector((state) => state.pushNotification.txDetails);
  const dispatch = useDispatch();

  if (!txDetails) return null;
  return (
    <PushTxDetailsModal
      tx={txDetails.tx}
      tokens={txDetails.tokens}
      onRequestClose={() => dispatch(pushCleanTxDetails())}
      isNFT={false}
    />
  );
}
