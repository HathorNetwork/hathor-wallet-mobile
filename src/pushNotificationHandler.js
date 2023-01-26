/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import notifee from '@notifee/react-native';
import { msgid, ngettext, t } from 'ttag';
import {
  NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_ENABLED,
  NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_DISABLED,
  NEW_TRANSACTION_RECEIVED_TITLE,
  pushNotificationKey,
  STORE,
  PUSH_ACTION,
  PUSH_CHANNEL_TRANSACTION,
} from './constants';
import { name as appName } from '../app.json';

export function setInitialNotificationData(notification) {
  STORE.setItem(pushNotificationKey.notificationData, notification.data);
}

/**
 * localization utils to map the message key to the correct message to localize
 */
const localization = {
  keys: new Set([
    NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_ENABLED,
    NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_DISABLED,
    NEW_TRANSACTION_RECEIVED_TITLE
  ]),
  hasKey: (key) => localization.keys.has(key),
  getMessage: (key, args) => {
    if (!localization.hasKey(key)) {
      console.debug('Unknown localization key for push notification message.', key);
      return '';
    }

    let message = '';
    if (key === NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_ENABLED) {
      if (!args) {
        console.debug(`The args for push notification message key ${NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_ENABLED} cannot be null or undefined.`, key);
        return '';
      }
      /**
       * We have 3 cases:
       * - 3 or more tokens: You have received 10 T2, 5 T1 and 2 other token on a new transaction.
       * - 2 tokens: You have received 10 T2 and 5 T1 on a new transaction.
       * - 1 token: You have received 10 T2 on a new transaction.
      */
      const countArgs = args.length;
      if (countArgs === 3) {
        const [firstToken, secondToken, other] = args;
        const otherCount = parseInt(other, 10);
        /**
         * @example
         * You have received 10 T2, 5 T1 and 2 other token on a new transaction.
         */
        message = ngettext(
          msgid`You have received ${firstToken}, ${secondToken} and ${otherCount} other token on a new transaction.`,
          `You have received ${firstToken}, ${secondToken} and ${otherCount} other tokens on a new transaction.`,
          otherCount
        );
      } else if (countArgs === 2) {
        const [firstToken, secondToken] = args;
        /**
         * @example
         * You have received 10 T2 and 5 T1 on a new transaction.
         */
        message = t`You have received ${firstToken} and ${secondToken} on a new transaction.`;
      } else if (countArgs === 1) {
        const [firstToken] = args;
        /**
         * @example
         * You have received 10 T2 on a new transaction.
         */
        message = t`You have received ${firstToken} on a new transaction.`;
      }
    } else if (key === NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_DISABLED) {
      message = t`There is a new transaction in your wallet.`;
    } else if (key === NEW_TRANSACTION_RECEIVED_TITLE) {
      message = t`New transaction received`;
    }
    return message;
  }
};

/**
 * Handle the message received when application is in foreground and background (not closed) state
 * @param {{
 *  data: Object,
 *  from: string,
 *  messageId: string,
 *  sentTime: number,
 *  ttl: number
 * }} message - Message received from wallet-service
 * @example
 * {
 *   bodyLocArgs: '[\"10 T2\",\"5 T1\",\"2\"]',
 *   bodyLocKey: 'new_transaction_received_description_with_tokens',
 *   titleLocKey: 'new_transaction_received_title',
 *   txId: 'txId1',
 * }
 * @inner
 */
export const messageHandler = async (message, isForeground) => {
  const { data } = message;
  if (!localization.hasKey(data.titleLocKey)) {
    console.debug('unknown message titleLocKey', data.titleLocKey);
    return;
  }

  if (!localization.hasKey(data.bodyLocKey)) {
    console.debug('unknown message bodyLocKey', data.bodyLocKey);
    return;
  }

  try {
    const bodyArgs = JSON.parse(data.bodyLocArgs);
    const title = localization.getMessage(data.titleLocKey);
    const body = localization.getMessage(data.bodyLocKey, bodyArgs);
    const { txId } = data;

    notifee.displayNotification({
      id: txId,
      title,
      body,
      android: {
        channelId: PUSH_CHANNEL_TRANSACTION,
        pressAction: {
          id: PUSH_ACTION.NEW_TRANSACTION,
          ...(!isForeground && { mainComponent: appName })
        }
      },
      data: {
        txId
      }
    });
  } catch (error) {
    console.error('Error while handling push notification message to be displayed.', error);
  }
};
