/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Alert } from 'react-native';
import hathorLib from '@hathor/wallet-lib';
import * as Sentry from '@sentry/react-native';
import VersionNumber from 'react-native-version-number';
import { t } from 'ttag';
import { SENTRY_DSN } from './constants';

/**
 * Send error to Sentry
 */
const sentryReportError = (error) => {
  Sentry.init({
    dsn: SENTRY_DSN,
  });
  Sentry.withScope((scope) => {
    scope.setExtra('App version', JSON.stringify(VersionNumber));
    const data = [];
    const accessData = hathorLib.wallet.getWalletAccessData();
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
    scope.setExtra('Access information', data);
    Sentry.captureException(error);
  });
};

/**
 * Capture all JS exceptions that might happen and show an alert to the user
 */
export const errorHandler = (error, isFatal) => {
  if (isFatal) {
    Alert.alert(
      t`Unexpected error occurred`,
      t`\nUnfortunately an unhandled error happened. We kindly ask you to report this error to the Hathor team clicking on the button below.\n\nNo sensitive data will be shared.`,
      [
        {
          text: t`Report error`,
          onPress: () => {
            sentryReportError(error);
          }
        },
        {
          text: t`Close`,
        }
      ]
    );
  } else {
    // So that we can see it in the ADB logs in case of Android if needed
    console.log('Unhandled not fatal error', error);
  }
};
