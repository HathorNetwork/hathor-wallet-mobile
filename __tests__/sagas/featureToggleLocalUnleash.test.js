/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';
import { jest, describe, test, expect, afterEach, beforeEach } from '@jest/globals';

const STORE_VERSION = '0.40.1';
let mockVersion = STORE_VERSION;
jest.mock('react-native-device-info', () => ({
  ...jest.requireActual('react-native-device-info/jest/react-native-device-info-mock'),
  getVersion: () => mockVersion,
}));

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

describe('the Unleash the app reads', () => {
  const dev = global.__DEV__;
  afterEach(() => {
    global.__DEV__ = dev;
    mockVersion = STORE_VERSION;
  });

  describe('in a debug build', () => {
    beforeEach(() => {
      global.__DEV__ = true;
    });

    test('is the e2e fake Unleash next to a local node', async () => {
      expect(await unleashUrlFor(localNetwork)).toBe('http://localhost:18042/proxy');
    });

    test('keeps the host the node is reached through', async () => {
      const viaHostAlias = { ...localNetwork, nodeUrl: 'http://10.0.2.2:18083/v1a/' };
      expect(await unleashUrlFor(viaHostAlias)).toBe('http://10.0.2.2:18042/proxy');
    });

    test('is the real Unleash on a public network', async () => {
      expect(await unleashUrlFor(PRE_SETTINGS_TESTNET)).toBe(UNLEASH_URL);
    });

    // The e2e build's network security config doesn't allow plain HTTP to it either.
    test('is the real Unleash on an IPv6 loopback node', async () => {
      const onIpv6 = { ...localNetwork, nodeUrl: 'http://[::1]:18083/v1a/' };
      expect(await unleashUrlFor(onIpv6)).toBe(UNLEASH_URL);
    });
  });

  describe('in the e2e build', () => {
    beforeEach(() => {
      global.__DEV__ = false;
      mockVersion = `${STORE_VERSION}-e2e`;
    });

    test('is the e2e fake Unleash next to a local node', async () => {
      expect(await unleashUrlFor(localNetwork)).toBe('http://localhost:18042/proxy');
    });

    test('is the real Unleash on a public network', async () => {
      expect(await unleashUrlFor(PRE_SETTINGS_TESTNET)).toBe(UNLEASH_URL);
    });
  });

  describe('in a store build', () => {
    beforeEach(() => {
      global.__DEV__ = false;
    });

    test.each([
      ['a release', STORE_VERSION],
      ['a release candidate', `${STORE_VERSION}-rc.1`],
    ])('is the real Unleash on a local node, as %s', async (_, version) => {
      mockVersion = version;
      expect(await unleashUrlFor(localNetwork)).toBe(UNLEASH_URL);
    });

    test('is the real Unleash on a public network', async () => {
      expect(await unleashUrlFor(PRE_SETTINGS_TESTNET)).toBe(UNLEASH_URL);
    });
  });

  // What getUnleashUrl trusts: only the e2e build type may carry the suffix.
  test('gets the e2e version suffix from the e2e build type alone', () => {
    const gradle = fs.readFileSync(path.resolve(__dirname, '../../android/app/build.gradle'), 'utf8');
    const suffixes = gradle.match(/versionNameSuffix\s+"[^"]*"/g);
    expect(suffixes).toEqual(['versionNameSuffix "-e2e"']);
    const e2eBlock = /\n {8}e2e \{.*?\n {8}\}/s.exec(gradle)[0];
    expect(e2eBlock).toContain(suffixes[0]);
  });
});
