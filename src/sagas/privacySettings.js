/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { all, call, put, takeLatest, takeEvery } from 'redux-saga/effects';

import { types, privacyDefaultModeSet } from '../actions';
import { PRIVACY_MODE, DEFAULT_PRIVACY_MODE } from '../constants';
import { STORE, PRIVACY_DEFAULT_MODE_KEY } from '../store';
import { logger } from '../logger';

const log = logger('privacySettings');

/**
 * Whitelist of valid privacy mode values. Anything else read from
 * persistent storage falls back to the default.
 */
const VALID_PRIVACY_MODES = new Set(Object.values(PRIVACY_MODE));

/**
 * Load the persisted default privacy mode from AsyncStorage and put it in
 * Redux. Falls back to DEFAULT_PRIVACY_MODE (Public) when the key is
 * missing — matches the upgrade path: existing users without a stored
 * preference land on Public.
 */
export function* onPrivacyDefaultModeLoad() {
  try {
    const stored = yield call([STORE, 'getItem'], PRIVACY_DEFAULT_MODE_KEY);
    const mode = VALID_PRIVACY_MODES.has(stored) ? stored : DEFAULT_PRIVACY_MODE;
    yield put(privacyDefaultModeSet(mode));
  } catch (e) {
    log.error('Failed to load privacy default mode from storage', e);
    yield put(privacyDefaultModeSet(DEFAULT_PRIVACY_MODE));
  }
}

/**
 * Write-through: when the user (or the load flow) dispatches
 * privacyDefaultModeSet, also persist the new value to AsyncStorage so
 * it survives app close + unlock. The reducer handles the in-memory
 * update independently — this saga only handles persistence.
 */
export function* onPrivacyDefaultModeSet({ payload }) {
  if (!VALID_PRIVACY_MODES.has(payload)) {
    log.error(`Refusing to persist invalid privacy mode: ${payload}`);
    return;
  }
  try {
    yield call([STORE, 'setItem'], PRIVACY_DEFAULT_MODE_KEY, payload);
  } catch (e) {
    log.error('Failed to persist privacy default mode', e);
  }
}

export function* saga() {
  yield all([
    takeLatest(types.PRIVACY_DEFAULT_MODE_LOAD, onPrivacyDefaultModeLoad),
    takeEvery(types.PRIVACY_DEFAULT_MODE_SET, onPrivacyDefaultModeSet),
  ]);
}
