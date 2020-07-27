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

/**
 * Send error to Sentry
 */
export const sentryReportError = (error) => {
  Sentry.init({
    dsn: 'https://c1ebae9159f741e8937abdbfbeba8e8a@o239606.ingest.sentry.io/5304101',
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
      t`\nUnfortunately a fatal error happened and you need to restart your app.\n\nBefore doing that, we kindly ask you to report this error to the Hathor team clicking on the button below.\n\nNo sensitive data will be shared.`,
      [{
        text: t`Report error`,
        onPress: () => {
          sentryReportError(error);
        }
      }]
    );
  } else {
    // So that we can see it in the ADB logs in case of Android if needed
    console.log('Unhandled not fatal error', error);
  }
};
