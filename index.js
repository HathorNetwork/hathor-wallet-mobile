/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import './i18nInit';
import { AppRegistry } from 'react-native';
import { setJSExceptionHandler } from 'react-native-exception-handler';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { errorHandler } from './src/errorHandler';
import { messageHandler } from './src/sagas/pushNotification';

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
const setNotifeeBackgroundListener = () => {
  try {
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      const { notification } = detail;

      if (type === EventType.DISMISSED) {
        notifee.cancelNotification(notification.id);
        return;
      }

      if (type === EventType.ACTION_PRESS) {
        notifee.cancelNotification(notification.id);
      }
    });
  } catch (error) {
    console.error('Error setting notifee background listener.', error);
  }
};
setNotifeeBackgroundListener();

/**
 * This function is called when the app is in background or quit
 * and a push notification from firebase is received.
 */
const setBackgroundMessageListener = () => {
  const onBackgroundMessage = async (message) => messageHandler(message);
  try {
    messaging().setBackgroundMessageHandler(onBackgroundMessage);
  } catch (error) {
    console.error('Error setting background message listener.', error);
  }
};
setBackgroundMessageListener();

// - errorHandler is the callback
// - second parameter is an optional boolean and defines the error handler behavior
//   If set to true the handler will be called in place of red screen
//   in development mode also (default is false)
setJSExceptionHandler(errorHandler);

AppRegistry.registerComponent(appName, () => App);
