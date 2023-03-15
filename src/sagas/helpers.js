/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { get } from 'lodash';
import { put, race, take, call } from 'redux-saga/effects';
import { t } from 'ttag';
import NavigationService from '../NavigationService';
import {
  setIsShowingPinScreen, types,
} from '../actions';

/**
 * Helper method to be used on take saga effect, will wait until an action
 * with type and payload matching the passed (type, payload)
 *
 * @param {String[] | String} type - String list or a simple string with the action type(s)
 * @param {Object} payload - Object with the keys and values to compare
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

/**
 * Handles errors thrown from the main saga (started with call) by yielding
 * an action passed as a parameter
 *
 * @param saga - The saga to call (synchronously)
 * @param failureAction - Yields this action (with put) if the main action throws
 */
export function errorHandler(saga, failureAction) {
  return function* handleAction(action) {
    try {
      yield call(saga, action);
    } catch (e) {
      console.error(`Captured error in ${action.type} saga`, e);
      yield put(failureAction);
    }
  };
}

/**
 * Opens the pin screen and waits for the user to enter the pin.
 * This method is used while processing some action on saga
 * and we need to wait for the user to enter the pin to continue.
 * @param {Function} dispatch - dispatch function from redux
 * @returns {Promise<string>} - Promise that resolves with the pin entered by the user
 */
export const showPinScreenForResult = async (dispatch) => new Promise((resolve) => {
  const params = {
    cb: (_pin) => {
      dispatch(setIsShowingPinScreen(false));
      resolve(_pin);
    },
    canCancel: false,
    screenText: t`Enter your 6-digit pin to authorize operation`,
    biometryText: t`Authorize operation`,
  };

  NavigationService.navigate('PinScreen', params);

  // We should set the global isShowingPinScreen
  dispatch(setIsShowingPinScreen(true));
});

/**
 * Check if the action is about to set screen to unlocked state.
 * @param {{ type: string, payload: boolean }} action
 * @returns {boolean} true if unlocked and false otherwise.
 */
export function isUnlockScreen(action) {
  return action.type === types.SET_LOCK_SCREEN
    && action.payload === false;
}
