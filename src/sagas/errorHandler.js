/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import hathorLib from '@hathor/wallet-lib';
import * as Sentry from '@sentry/react-native';
import VersionNumber from 'react-native-version-number';
import {
  takeLatest,
  all,
  put,
  race,
  take,
} from 'redux-saga/effects';
import { SENTRY_DSN } from '../constants';
import { showErrorModal } from '../actions';

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

export function* errorModalHandler(action) {
  const { reportError } = yield race({
    reportError: take('ALERT_REPORT_ERROR'),
    dontReportError: take('ALERT_DONT_REPORT_ERROR'),
  });

  const { isFatal } = action.payload;

  if (isFatal) {
    yield put(showErrorModal(!!reportError));
  }
}

export function* saga() {
  yield all([
    takeLatest('EXCEPTION_CAPTURED', errorModalHandler),
  ]);
}
