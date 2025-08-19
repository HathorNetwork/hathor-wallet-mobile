/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  call,
  fork,
  all,
  put,
} from 'redux-saga/effects';
import { checkForFeatureFlag } from './helpers';
import { SES_FEATURE_TOGGLE } from '../constants';
import { onExceptionCaptured } from '../actions';
import { verifySesEnabled } from '../utils';

/**
 * `init` will run on the app initialization.
 *
 */
function* init() {
  // SES should be enabled in both platforms
  const sesEnabled = verifySesEnabled();

  if (!sesEnabled) {
    // This is an issue, the environment is not secure, we should issue a fatal
    // error.
    yield put(onExceptionCaptured(new Error('SES should be enabled but environment is not secure, failing!'), true));
  }
}

export function* isSESEnabled() {
  const sesEnabled = yield call(checkForFeatureFlag, SES_FEATURE_TOGGLE);

  return sesEnabled;
}

export function* saga() {
  yield all([
    fork(init),
  ]);
}
