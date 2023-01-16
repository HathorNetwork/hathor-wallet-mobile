/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import hathorLib from '@hathor/wallet-lib';
import * as Sentry from '@sentry/react-native';
import VersionNumber from 'react-native-version-number';
import { SENTRY_DSN } from './constants';
import { store } from './reducer';
import { setErrorModal } from './actions';

/**
 * Send error to Sentry
 */
export const sentryReportError = (error) => {
  Sentry.init({
    dsn: SENTRY_DSN,
  });
  Sentry.withScope((scope) => {
    scope.setExtra('App version', JSON.stringify(VersionNumber));
    const data = [];
    const accessData = hathorLib.wallet.getWalletAccessData();

    if (accessData) {
      for (const [key, value] of Object.entries(accessData)) {
        const obj = {
          key,
          type: typeof value,
        };
        if (typeof value === 'string') {
          obj.size = value.length;
        }
        data.push(obj);
      }
    }

    scope.setExtra('Access information', data);
    Sentry.captureException(error);
  });
};

/**
 * Capture all JS exceptions that might happen and show an alert to the user
 */
export function errorHandler(error, isFatal) {
  if (isFatal) {
    return null;
  }

  // So that we can see it in the ADB logs in case of Android if needed
  // eslint-disable-next-line
  console.log('Unhandled not fatal error', error);
  return null;
}
