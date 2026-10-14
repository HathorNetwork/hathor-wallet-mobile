/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';

// What iOS reports for a 0.40.0-rc.1 build: its native version can't carry the rc suffix.
jest.mock('react-native-version-number', () => ({ appVersion: '0.40.0', buildVersion: '0.1.0' }));

const mockClients = [];
jest.mock('@hathor/unleash-client', () => {
  class MockUnleashClient {
    constructor(options) {
      this.options = options;
      mockClients.push(this);
    }

    // eslint-disable-next-line class-methods-use-this
    fetchToggles() {
      return Promise.resolve();
    }

    // eslint-disable-next-line class-methods-use-this
    getToggles() {
      return [];
    }
  }
  return { __esModule: true, default: MockUnleashClient, FetchTogglesStatus: {} };
});

/* eslint-disable import/first */
import { runSaga } from 'redux-saga';
import { Platform } from 'react-native';
import { monitorFeatureFlags } from '../../src/sagas/featureToggle';
import { PRE_SETTINGS_TESTNET } from '../../src/constants';
import packageJson from '../../package.json';
/* eslint-enable import/first */

describe('monitorFeatureFlags', () => {
  test('sends Unleash the version in package.json, not the native one', async () => {
    await runSaga(
      {
        dispatch: () => {},
        getState: () => ({ networkSettings: PRE_SETTINGS_TESTNET }),
      },
      monitorFeatureFlags,
      0,
      false,
    ).toPromise();

    expect(mockClients).toHaveLength(1);
    const { context, appName } = mockClients[0].options;
    expect(context.properties).toEqual({
      platform: Platform.OS,
      stage: PRE_SETTINGS_TESTNET.stage,
      network: PRE_SETTINGS_TESTNET.fullNetwork,
      appVersion: packageJson.version,
    });
    expect(context.properties.appVersion).not.toBe('0.40.0');
    expect(appName).toBe(`wallet-mobile-${Platform.OS}`);
  });
});
