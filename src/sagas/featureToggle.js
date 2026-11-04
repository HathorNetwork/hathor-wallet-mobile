/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Platform } from 'react-native';
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
  networkSettingsKeyMap,
  UNLEASH_URL,
  UNLEASH_CLIENT_KEY,
  E2E_UNLEASH_PORT,
  UNLEASH_POLLING_INTERVAL,
  FEATURE_TOGGLE_DEFAULTS,
} from '../constants';
import { disableFeaturesIfNeeded } from './helpers';
import { logger } from '../logger';
import { STORE, FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY } from '../store';
// The app's version as package.json has it, the same on both platforms. The native version isn't:
// iOS can't carry a prerelease suffix, so a 0.40.0-rc.1 build reports 0.40.0 there, and Unleash
// couldn't tell a release candidate from the release.
import { version as appVersion } from '../../package.json';

const MAX_RETRIES = 5;

const log = logger('featureToggle');

// Hosts a local node is reached through: the emulator's adb reverse and its alias for the host.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '10.0.2.2'];

/**
 * Debug builds on a local network read their flags from the e2e fake Unleash next to the node,
 * so a test run controls every flag. Public networks and release builds always read the real one:
 * a public network can misbehave with a flag on that its servers expect off.
 */
export function getUnleashUrl(nodeUrl) {
  if (!__DEV__) {
    return UNLEASH_URL;
  }
  const match = /^(https?):\/\/(\[[^\]]+\]|[^/:]+)/.exec(nodeUrl || '');
  if (!match || !LOCAL_HOSTS.includes(match[2])) {
    return UNLEASH_URL;
  }
  return `${match[1]}://${match[2]}:${E2E_UNLEASH_PORT}/proxy`;
}

export function* handleInitFailed(currentRetry) {
  if (currentRetry >= MAX_RETRIES) {
    log.error('Max retries reached while trying to create the unleash-proxy client.');
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
      log.error('Erroed fetching feature toggles', e);
    }
  }
}

export function* handleToggleUpdate() {
  const unleashClient = yield select((state) => state.unleashClient);
  const networkSettings = yield select((state) => state.networkSettings);

  const toggles = unleashClient.getToggles();
  const featureToggles = disableFeaturesIfNeeded(networkSettings, mapFeatureToggles(toggles));
  STORE.setItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY, featureToggles);

  yield put(setFeatureToggles(featureToggles));
  yield put({ type: types.FEATURE_TOGGLE_UPDATED });
}

export function* monitorFeatureFlags(currentRetry = 0, createRoutine = true) {
  let stage;
  let fullNetwork;
  let nodeUrl;
  // We try to get the network settings from the storage (which is updated as soon
  // as we persist the networkSettings update) and if it's empty, we get the default state
  const networkSettingsStorage = STORE.getItem(networkSettingsKeyMap.networkSettings);
  if (networkSettingsStorage) {
    ({ stage, fullNetwork, nodeUrl } = networkSettingsStorage);
  } else {
    const networkSettingsState = yield select((state) => state.networkSettings);
    ({ stage, fullNetwork, nodeUrl } = networkSettingsState);
  }
  const options = {
    userId: getUniqueId(),
    properties: {
      platform: Platform.OS,
      stage,
      network: fullNetwork,
      appVersion,
    },
  };

  const unleashClient = new UnleashClient({
    url: getUnleashUrl(nodeUrl),
    clientKey: UNLEASH_CLIENT_KEY,
    refreshInterval: -1,
    disableRefresh: true, // Disable it, we will handle it ourselves
    appName: `wallet-mobile-${Platform.OS}`,
    context: options,
  });

  try {
    yield put(setUnleashClient(unleashClient));

    yield call(() => unleashClient.fetchToggles());

    // We need to fork it only once, so when we call this method
    // after a network change, we don't need to create the routine again
    if (createRoutine) {
      // Fork the routine to download toggles.
      yield fork(fetchTogglesRoutine);
    }

    // At this point, unleashClient.fetchToggles() already fetched the toggles
    // (this will throw if it hasn't)
    const featureToggles = mapFeatureToggles(unleashClient.getToggles());
    STORE.setItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY, featureToggles);

    yield put(setFeatureToggles(featureToggles));
    yield put(featureToggleInitialized());
  } catch (e) {
    log.error(e);
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
