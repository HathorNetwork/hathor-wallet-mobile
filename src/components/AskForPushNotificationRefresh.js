/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { pushDismissRegistrationRefreshQuestion, pushRegistrationRequested } from '../actions';
import ActionModal from './ActionModal';

export default function AskForPushNotificationRefresh() {
  const showRegistrationRefreshQuestion = useSelector(
    (state) => state.pushNotification.showRegistrationRefreshQuestion,
  );
  const {
    enabled,
    showAmountEnabled,
    deviceId,
  } = useSelector((state) => state.pushNotification);
  const dispatch = useDispatch();

  const requestRegistration = () => {
    dispatch(pushDismissRegistrationRefreshQuestion());
    dispatch(pushRegistrationRequested({ enabled, showAmountEnabled, deviceId }));
  };

  if (!showRegistrationRefreshQuestion) {
    return null;
  }
  return (
    <ActionModal
      title={t`Refresh your push notification registration`}
      text={t`In order to keep receiving push notifications, you need to refresh your registration. Do you want to do it now?`}
      button={t`Refresh`}
      onAction={() => requestRegistration()}
      onDismiss={() => dispatch(pushDismissRegistrationRefreshQuestion())}
    />
  );
}
