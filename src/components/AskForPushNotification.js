import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { pushDismissOptInQuestion } from '../actions';
import ActionModal from './ActionModal';

export default function AskForPushNotification(props) {
  const showOptIn = useSelector((state) => state.pushNotification.showOptInQuestion);
  const dispatch = useDispatch();

  const onEnablePushNotifications = () => {
    props.navigation.navigate('PushNotification');
    dispatch(pushDismissOptInQuestion());
  };

  if (!showOptIn) {
    return null;
  }
  return (
    <ActionModal
      title={t`Do you want to enable push notifications for this wallet?`}
      text={t`You can always change this later in the settings menu`}
      button={t`Yes, enable`}
      onAction={() => onEnablePushNotifications()}
      onDismiss={() => dispatch(pushDismissOptInQuestion())}
    />
  );
}
