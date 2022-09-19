/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { get } from 'lodash';
import { put, race, take } from 'redux-saga/effects';

/**
 * Helper method to be used on take saga effect, will wait until an action
 * with type and payload matching the passed (type, payload)
 *
 * @param type - String[] with the action types
 * @param payload - Object with the keys and values to compare
 */
export const specificTypeAndPayload = (_types, payload) => (action) => {
  let types = _types;

  if (!Array.isArray(_types)) {
    types = [_types];
  }

  if (types.indexOf(action.type) === -1) {
    return false;
  }

  const keys = Object.keys(payload);

  for (const key of keys) {
    const actionKey = get(action, key);
    const payloadKey = get(payload, key);

    if (actionKey !== payloadKey) {
      return false;
    }
  }

  return true;
};

/**
 * Helper method to dispatch an action and wait for the response
 *
 * @param action - The action to dispatch
 * @param successAction - The action to expect as a success
 * @param failureAction - The action to expect as a failure
 */
export function* dispatchAndWait(action, successAction, failureAction) {
  yield put(action);

  return yield race({
    success: take(successAction),
    falure: take(failureAction),
  });
}
