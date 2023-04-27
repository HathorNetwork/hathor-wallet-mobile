/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Sentry from '@sentry/react-native';
import VersionNumber from 'react-native-version-number';
import {
  select,
  takeLatest,
  all,
  call,
  put,
  race,
  take,
} from 'redux-saga/effects';
import { SENTRY_DSN, STORE } from '../constants';
import { showErrorModal } from '../actions';

/**
 * Send error to Sentry
 */
export const sentryReportError = (error, loadedAccessData) => {
  const removePersonalData = (accessData) => {
    const data = [];
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
    return data;
  };

  Sentry.init({
    dsn: SENTRY_DSN,
  });
  Sentry.withScope((scope) => {
    scope.setExtra('App version', JSON.stringify(VersionNumber));
    scope.setExtra('Access information', removePersonalData(STORE.getAccessData()));
    scope.setExtra('Loaded access information', removePersonalData(loadedAccessData));
    Sentry.captureException(error);
  });
};

export function* errorModalHandler(action) {
  const { reportError } = yield race({
    reportError: take('ALERT_REPORT_ERROR'),
    dontReportError: take('ALERT_DONT_REPORT_ERROR'),
  });

  const { isFatal, error } = action.payload;

  if (reportError) {
    const wallet = yield select((state) => state.wallet);
    const accessData = yield call(() => wallet.getAccessData().catch(() => null));
    sentryReportError(error, accessData);
  }

  if (isFatal) {
    yield put(showErrorModal(!!reportError));
  }
}

export function* saga() {
  yield all([
    takeLatest('EXCEPTION_CAPTURED', errorModalHandler),
  ]);
}
