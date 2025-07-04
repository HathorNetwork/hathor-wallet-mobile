/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { getMessaging, getToken, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { onExceptionCaptured } from '../actions';
import {
  messageHandler,
  setInitialNotificationData,
  setNotificationError,
} from './pushNotificationHandler';
import { store } from '../reducers/reducer.init';
import { logger } from '../logger';

const log = logger('push-notification-bg');

/**
* This function verifies if the device is registered on firebase,
* it also captures if firebase itself is initialized.
*/
const isRegisteredOnFirebase = () => {
  try {
    const messaging = getMessaging();
    const fcmToken = getToken(messaging);
    // Make sure deviceId is registered on the FCM
    if (!fcmToken) {
      log.debug('The device is not registered on the firebase yet.');
      return false;
    }
  } catch (error) {
    log.error('Error confirming the device is registered on firebase while'
      + ' loading the background message listener. Maybe the auto initialization of firebase'
      + ' is disabled.', error);
    return false;
  }

  return true;
};

/**
 * Install the listener to handle push notifications when the application is in background or quit.
 */
export const setBackgroundMessageListener = () => {
  if (!isRegisteredOnFirebase()) {
    log.debug('Halting setBackgroundMessageListener.');
    return;
  }

  const onBackgroundMessage = async (message) => {
    try {
      await messageHandler(message);
    } catch (error) {
      setNotificationError({ message: error.message });
    }
  };

  try {
    const messaging = getMessaging();
    setBackgroundMessageHandler(messaging, onBackgroundMessage);
  } catch (error) {
    log.error('Error setting firebase background message listener.', error);
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
  if (!isRegisteredOnFirebase()) {
    log.debug('Halting setNotifeeBackgroundListener.');
    return;
  }

  try {
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      const { notification } = detail;
      if (type === EventType.DISMISSED) {
        await notifee.cancelNotification(notification.id);
        return;
      }

      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        log.debug('Notification pressed or action pressed on background.');
        setInitialNotificationData(notification);
        await notifee.cancelNotification(notification.id);
      }
    });
  } catch (error) {
    log.error('Error setting notifee background message listener.', error);
    store.dispatch(onExceptionCaptured(error));
  }
};
