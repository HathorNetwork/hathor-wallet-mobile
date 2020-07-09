/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Alert, Clipboard } from 'react-native';
import hathorLib from '@hathor/wallet-lib';
import * as Sentry from '@sentry/react-native';
import VersionNumber from 'react-native-version-number';

/**
 * Send error to Sentry
 */
export const sentryReportError = (error) => {
  Sentry.init({
    dsn: 'https://c1ebae9159f741e8937abdbfbeba8e8a@o239606.ingest.sentry.io/5304101',
  });
  Sentry.withScope((scope) => {
    scope.setExtra('App version', JSON.stringify(VersionNumber));
    Sentry.captureException(error);
  });
};

/**
 * Copy access data from storage to the clipboard.
 * This could be useful to ask the user to copy it and check if
 * all keys are correctly there.
 * With this we prevent sending sensitive data to Sentry
 */
export const copyData = (error) => {
  const accessData = JSON.stringify(hathorLib.wallet.getWalletAccessData());
  Clipboard.setString(`${error.name} - ${error.message}\n${accessData}`);
};

/**
 * Capture all JS exceptions that might happen and show an alert to the user
 */
export const errorHandler = (error, isFatal) => {
  if (isFatal) {
    Alert.alert(
      'Unexpected error occurred',
      '\nUnfortunately a fatal error happened and you need to restart your app.\n\nBefore doing that, we kindly ask you to report this error to the Hathor team clicking on the button below.',
      [{
        text: 'Report error',
        onPress: () => {
          sentryReportError(error);
        }
      },
      {
        text: 'Copy data',
        onPress: () => {
          copyData(error);
        }
      }]
    );
  } else {
    // So that we can see it in the ADB logs in case of Android if needed
    console.log('Unhandled not fatal error', error);
  }
};
