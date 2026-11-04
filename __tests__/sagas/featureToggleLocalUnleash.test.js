/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

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
import { monitorFeatureFlags } from '../../src/sagas/featureToggle';
import { PRE_SETTINGS_TESTNET, UNLEASH_URL } from '../../src/constants';
/* eslint-enable import/first */

const localNetwork = {
  ...PRE_SETTINGS_TESTNET,
  stage: 'testnet-shielded-outputs',
  fullNetwork: 'testnet-shielded-outputs',
  nodeUrl: 'http://localhost:18083/v1a/',
  txMiningServiceUrl: 'http://localhost:18035/',
};

async function unleashUrlFor(networkSettings) {
  mockClients.length = 0;
  await runSaga(
    { dispatch: () => {}, getState: () => ({ networkSettings }) },
    monitorFeatureFlags,
    0,
    false,
  ).toPromise();
  return String(mockClients[0].options.url);
}

describe('the Unleash a debug build reads on a local network', () => {
  const dev = global.__DEV__;
  afterEach(() => {
    global.__DEV__ = dev;
  });

  test('is the e2e fake Unleash next to the local node', async () => {
    global.__DEV__ = true;
    expect(await unleashUrlFor(localNetwork)).toBe('http://localhost:18042/proxy');
  });

  test('keeps the host the node is reached through', async () => {
    global.__DEV__ = true;
    const viaHostAlias = { ...localNetwork, nodeUrl: 'http://10.0.2.2:18083/v1a/' };
    expect(await unleashUrlFor(viaHostAlias)).toBe('http://10.0.2.2:18042/proxy');
  });

  test('is the real Unleash on a public network', async () => {
    global.__DEV__ = true;
    expect(await unleashUrlFor(PRE_SETTINGS_TESTNET)).toBe(UNLEASH_URL);
  });

  test('is the real Unleash in a release build, even on a local network', async () => {
    global.__DEV__ = false;
    expect(await unleashUrlFor(localNetwork)).toBe(UNLEASH_URL);
  });
});
