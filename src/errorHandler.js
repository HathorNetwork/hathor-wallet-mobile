/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { store } from './reducer';
import { onExceptionCaptured } from './actions';

/**
 * Capture all JS exceptions that might happen and show an alert to the user
 */
export function errorHandler(error, isFatal) {
  if (isFatal) {
    store.dispatch(onExceptionCaptured(error, isFatal));

    return;
  }

  // So that we can see it in the ADB logs in case of Android if needed
  // eslint-disable-next-line
  console.log('Unhandled not fatal error', error);
  return null;
}
