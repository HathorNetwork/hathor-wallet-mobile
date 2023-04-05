/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Platform } from 'react-native';
import { UnleashClient } from 'unleash-proxy-client';
import { get } from 'lodash';

import {
  takeEvery,
  all,
  call,
  put,
  cancelled,
  select,
  take,
  fork,
} from 'redux-saga/effects';
import { eventChannel } from 'redux-saga';
import { getUniqueId } from 'react-native-device-info';
import {
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

const UnleashEvent = {
  UPDATE: 'update',
};

export function* monitorFeatureFlags() {
  const unleashClient = new UnleashClient({
    url: UNLEASH_URL,
    clientKey: UNLEASH_CLIENT_KEY,
    refreshInterval: UNLEASH_POLLING_INTERVAL,
    appName: `wallet-mobile-${Platform.OS}`,
  });

  const options = {
    userId: getUniqueId(),
    properties: {
      platform: Platform.OS,
      stage: STAGE,
    },
  };

  unleashClient.updateContext(options);

  yield put(setUnleashClient(unleashClient));

  // Listeners should be set before unleashClient.start so we don't miss
  // updates
  yield fork(setupUnleashListeners, unleashClient);
  yield call(() => unleashClient.start());

  const featureToggles = mapFeatureToggles(unleashClient.toggles);

  yield put(setFeatureToggles(featureToggles));
  yield put(featureToggleInitialized());
}

export function* setupUnleashListeners(unleashClient) {
  const channel = eventChannel((emitter) => {
    const listener = (state) => emitter(state);

    unleashClient.on(UnleashEvent.UPDATE, () => emitter({
      type: 'FEATURE_TOGGLE_UPDATE',
    }));

    return () => {
      unleashClient.removeListener('update', listener);
    };
  });

  try {
    while (true) {
      const message = yield take(channel);

      yield put({
        type: message.type,
        payload: message.data,
      });
    }
  } finally {
    if (yield cancelled()) {
      // When we close the channel, it will remove the event listener
      channel.close();
    }
  }
}

function mapFeatureToggles(toggles) {
  return toggles.reduce((acc, toggle) => {
    acc[toggle.name] = get(toggle, 'enabled', FEATURE_TOGGLE_DEFAULTS[toggle.name] || false);

    return acc;
  }, {});
}

export function* handleToggleUpdate() {
  const unleashClient = yield select((state) => state.unleashClient);

  if (!unleashClient) {
    return;
  }

  const { toggles } = unleashClient;
  const featureToggles = mapFeatureToggles(toggles);

  yield put(setFeatureToggles(featureToggles));
  yield put({ type: 'FEATURE_TOGGLE_UPDATED' });
}

export function* saga() {
  yield all([
    fork(monitorFeatureFlags),
    takeEvery('FEATURE_TOGGLE_UPDATE', handleToggleUpdate),
  ]);
}
