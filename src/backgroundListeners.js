/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { store } from './reducer';
import { onExceptionCaptured } from './actions';
import {
  messageHandler,
  setInitialNotificationData,
} from './pushNotificationHandler';

/**
 * Install the listener to handle push notifications when the application is in background or quit.
 */
export const setBackgroundMessageListener = () => {
  const onBackgroundMessage = async (message) => messageHandler(message);
  try {
    messaging().setBackgroundMessageHandler(onBackgroundMessage);
  } catch (error) {
    console.error('Error setting firebase background message listener.', error);
    store.dispatch(onExceptionCaptured(error));
  }
};

/**
 * This function is called when the app is in background or **quit** state
 * and a push notification from **notifee** is received. It also handles
 * notification events like dismiss and action press.
 *
 * @see https://notifee.app/react-native/reference/eventtype
 *
 * In this project the Notifee is used to interprete the data message received
 * from firebase and show the notification to the user.
 */
export const setNotifeeBackgroundListener = () => {
  try {
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      const { notification } = detail;

      if (type === EventType.DISMISSED) {
        await notifee.cancelNotification(notification.id);
        return;
      }

      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        setInitialNotificationData(notification);
        await notifee.cancelNotification(notification.id);
      }
    });
  } catch (error) {
    console.error('Error setting notifee background message listener.', error);
    store.dispatch(onExceptionCaptured(error));
  }
};
