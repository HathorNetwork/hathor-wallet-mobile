/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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

  const putDismissOptInQuestion = () => {
    dispatch(pushDismissOptInQuestion());
  };

  const pushNotificationOptInModal = () => (
    <ActionModal
      title={t`Do you want to enable push notifications for this wallet?`}
      text={t`You can always change this later in the settings menu`}
      button={t`Yes, enable`}
      onAction={onEnablePushNotifications}
      onDismiss={putDismissOptInQuestion}
    />
  );

  if (showOptIn) {
    return pushNotificationOptInModal();
  }

  return null;
}
