/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Platform } from 'react-native';
import VersionNumber from 'react-native-version-number';
import UnleashClient, { FetchTogglesStatus } from '@hathor/unleash-client';
import { get } from 'lodash';

import {
  all,
  call,
  delay,
  put,
  select,
  fork,
  spawn,
  takeEvery,
} from 'redux-saga/effects';
import { getUniqueId } from 'react-native-device-info';
import {
  types,
  setUnleashClient,
  setFeatureToggles,
  featureToggleInitialized,
} from '../actions';
import {
  UNLEASH_URL,
  UNLEASH_CLIENT_KEY,
  UNLEASH_POLLING_INTERVAL,
  STAGE,
  FEATURE_TOGGLE_DEFAULTS,
} from '../constants';
import { disableFeaturesIfNeeded } from './helpers';

const MAX_RETRIES = 5;

export function* handleInitFailed(currentRetry) {
  if (currentRetry >= MAX_RETRIES) {
    console.error('Max retries reached while trying to create the unleash-proxy client.');
    const unleashClient = yield select((state) => state.unleashClient);

    if (unleashClient) {
      unleashClient.close();
      yield put(setUnleashClient(null));
    }

    // Even if unleash failed, we should allow the app to continue as it
    // has defaults set for all feature toggles. Emit featureToggleInitialized
    // so sagas waiting for it will resume.
    yield put(featureToggleInitialized());
    return;
  }

  yield spawn(monitorFeatureFlags, currentRetry + 1);
}

export function* fetchTogglesRoutine() {
  while (true) {
    // Wait first so we don't double-check on initialization
    yield delay(UNLEASH_POLLING_INTERVAL);

    const unleashClient = yield select((state) => state.unleashClient);

    try {
      const state = yield call(() => unleashClient.fetchToggles());
      if (state === FetchTogglesStatus.Updated) {
        yield put({ type: types.FEATURE_TOGGLE_UPDATE });
      }
    } catch (e) {
      // No need to do anything here as it will try again automatically in
      // UNLEASH_POLLING_INTERVAL. Just prevent it from crashing the saga.
      console.error('Erroed fetching feature toggles');
    }
  }
}

export function* handleToggleUpdate() {
  console.log('Handling feature toggle update');
  const unleashClient = yield select((state) => state.unleashClient);
  const networkSettings = yield select((state) => state.networkSettings);

  const toggles = unleashClient.getToggles();
  const featureToggles = disableFeaturesIfNeeded(networkSettings, mapFeatureToggles(toggles));

  yield put(setFeatureToggles(featureToggles));
  yield put({ type: types.FEATURE_TOGGLE_UPDATED });
}

export function* monitorFeatureFlags(currentRetry = 0) {
  const { appVersion } = VersionNumber;

  const options = {
    userId: getUniqueId(),
    properties: {
      platform: Platform.OS,
      stage: STAGE,
      appVersion,
    },
  };

  const unleashClient = new UnleashClient({
    url: UNLEASH_URL,
    clientKey: UNLEASH_CLIENT_KEY,
    refreshInterval: -1,
    disableRefresh: true, // Disable it, we will handle it ourselves
    appName: `wallet-mobile-${Platform.OS}`,
    context: options,
  });

  try {
    yield put(setUnleashClient(unleashClient));

    yield call(() => unleashClient.fetchToggles());

    // Fork the routine to download toggles.
    yield fork(fetchTogglesRoutine);

    // At this point, unleashClient.fetchToggles() already fetched the toggles
    // (this will throw if it hasn't)
    const featureToggles = mapFeatureToggles(unleashClient.getToggles());

    yield put(setFeatureToggles(featureToggles));
    yield put(featureToggleInitialized());
  } catch (e) {
    yield put(setUnleashClient(null));

    // Wait 500ms before retrying
    yield delay(500);

    // Spawn so it's detached from the current thread
    yield spawn(handleInitFailed, currentRetry);
  }
}

function mapFeatureToggles(toggles) {
  return toggles.reduce((acc, toggle) => {
    acc[toggle.name] = get(
      toggle,
      'enabled',
      // Configure in this constant the feature toggle's default value.
      FEATURE_TOGGLE_DEFAULTS[toggle.name] || false,
    );

    return acc;
  }, {});
}

export function* saga() {
  yield all([
    fork(monitorFeatureFlags),
    takeEvery(types.FEATURE_TOGGLE_UPDATE, handleToggleUpdate),
  ]);
}
