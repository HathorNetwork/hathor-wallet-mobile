/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  fork,
  all,
  put,
} from 'redux-saga/effects';
import { onExceptionCaptured } from '../actions';
import { verifySesEnabled } from '../utils';

/**
 * `init` will run on the app initialization.
 *
 */
function* init() {
  // SES should be enabled in both platforms
  if (!verifySesEnabled()) {
    // This is an issue, the environment is not secure, we should issue a fatal
    // error.
    yield put(onExceptionCaptured(new Error('SES should be enabled but environment is not secure, failing!'), true));
  }
}

export function* saga() {
  yield all([
    fork(init),
  ]);
}
