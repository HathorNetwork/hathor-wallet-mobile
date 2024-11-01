/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MMKV } from 'react-native-mmkv';
import RNRestart from 'react-native-restart';
import {
  call,
  fork,
  take,
  all,
  put,
} from 'redux-saga/effects';
import { checkForFeatureFlag } from './helpers';
import { SES_FEATURE_TOGGLE, SHOULD_ENABLE_SES_STORAGE_KEY } from '../constants';
import { logger } from '../logger';
import { onExceptionCaptured } from '../actions';
import { verifySesEnabled } from '../utils';

const log = logger('ses');

const storage = new MMKV();

function disableSes(restart = true) {
  log.debug('Disabling SES');
  storage.set(SHOULD_ENABLE_SES_STORAGE_KEY, false);

  if (restart) {
    RNRestart.restart();
  }
}

function enableSes(restart = true) {
  storage.set(SHOULD_ENABLE_SES_STORAGE_KEY, true);

  if (restart) {
    RNRestart.restart();
  }
}

/**
 * `init` will run on the app initialization.
 *
 */
function* init() {
  const storageEnabled = storage.getBoolean('should-enable-ses');
  const unleashEnabled = yield call(checkForFeatureFlag, SES_FEATURE_TOGGLE);
  const sesEnabled = verifySesEnabled();

  if (unleashEnabled && storageEnabled && !sesEnabled) {
    // This is an issue, the environment is not secure, we should issue a fatal
    // error.
    yield put(onExceptionCaptured(new Error('SES should be enabled but environment is not secure, failing!'), true));
  }

  if (!unleashEnabled && storageEnabled) {
    log.debug('Unleash is disabled and storage is not, disabling SES!');
    // SES was disabled in Unleash and is enabled in the storage,
    // meaning that it will be loaded in the next boot we should disable it in
    // storage which gets read in the react-native initialization
    // (more on this in patches/react-native+0.72.5.patch) and restart the
    // react-native bundle.
    disableSes();
  }

  if (unleashEnabled && !storageEnabled) {
    log.debug('Unleash is enabled and storage is not, enabling SES!');
    enableSes();
  }
}

export function* isSESEnabled() {
  const sesEnabled = yield call(checkForFeatureFlag, SES_FEATURE_TOGGLE);

  return sesEnabled;
}

/**
 * This saga listens for the feature toggles provider and disables SES by restarting
 * the react-native bundle if the feature was enabled and is now disabled.
 */
export function* featureToggleUpdateListener() {
  while (true) {
    const oldSesEnabled = yield call(isSESEnabled);
    yield take('FEATURE_TOGGLE_UPDATED');
    const newSesEnabled = yield call(isSESEnabled);

    if (oldSesEnabled && !newSesEnabled) {
      // SES was disabled on the feature toggle provider
      disableSes();
    }

    if (newSesEnabled && !oldSesEnabled) {
      // SES was enabled on the feature-toggle provider, enable it without
      // restarting the bundle
      enableSes(false);
    }
  }
}

export function* saga() {
  yield all([
    fork(init),
    fork(featureToggleUpdateListener),
  ]);
}
