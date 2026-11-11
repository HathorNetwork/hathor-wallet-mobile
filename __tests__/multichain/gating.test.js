/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

// eslint-disable-next-line global-require
jest.mock('../../src/multichain/chains', () => require('./fakes/chainsModule'));

/* eslint-disable import/first */
import {
  MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE,
  MULTICHAIN_FEATURE_TOGGLE,
} from '../../src/constants';
import { canTransfer, CHAIN, getSideChainConfig, otherChain } from '../../src/multichain/chains';
import {
  getMultichainDevBackendFeatureToggle,
  getMultichainFeatureToggle,
  getMultichainFeatureToggleAtUnlock,
  isSideChainAvailable,
  isSideChainConnected,
  isWaitingForNext,
  selectDevBackend,
  selectMappedNextId,
  selectSideChainConfig,
  selectTokenMap,
} from '../../src/multichain/gating';
import { MULTICHAIN_INITIAL_STATE, NEXT_STATUS } from '../../src/multichain/state';
import { FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY, STORE } from '../../src/store';
import { FAKE_NETWORK } from './fakes/sideChain';
/* eslint-enable import/first */

const actualChains = jest.requireActual('../../src/multichain/chains');

const state = ({
  flag = true,
  network = FAKE_NETWORK,
  connected = true,
  nextStatus = NEXT_STATUS.READY,
} = {}) => ({
  featureToggles: { [MULTICHAIN_FEATURE_TOGGLE]: flag },
  fullNodeNetworkName: network,
  multichain: {
    ...MULTICHAIN_INITIAL_STATE,
    connectedNetworks: connected ? { [network]: true } : {},
    next: { ...MULTICHAIN_INITIAL_STATE.next, status: nextStatus },
  },
});

describe('getSideChainConfig', () => {
  // A side chain is pinned once its network is deployed: none is yet.
  test('gives no network a side chain until one is deployed', () => {
    for (const network of ['testnet', 'testnet-hotel', 'privatenet', 'mainnet']) {
      expect(actualChains.getSideChainConfig(network)).toBeNull();
    }
  });

  test('gives no side chain before the wallet knows its network', () => {
    expect(actualChains.getSideChainConfig(null)).toBeNull();
  });
});

describe('the flags', () => {
  test('are off unless Unleash returns them', () => {
    expect(getMultichainFeatureToggle({ featureToggles: {} })).toBe(false);
  });
});

describe('the multichain flag at an unlock', () => {
  afterEach(() => {
    STORE.removeItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY);
  });

  const waiting = { featureTogglesInitialized: false, featureToggles: {} };

  test("is Unleash's answer once it came, whatever this device saved", () => {
    STORE.setItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY, { [MULTICHAIN_FEATURE_TOGGLE]: true });
    expect(getMultichainFeatureToggleAtUnlock({
      featureTogglesInitialized: true,
      featureToggles: {},
    })).toBe(false);
    STORE.removeItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY);
    expect(getMultichainFeatureToggleAtUnlock({
      featureTogglesInitialized: true,
      featureToggles: { [MULTICHAIN_FEATURE_TOGGLE]: true },
    })).toBe(true);
  });

  test('is the answer this device saved until Unleash answers, and off with none', () => {
    STORE.setItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY, { [MULTICHAIN_FEATURE_TOGGLE]: true });
    expect(getMultichainFeatureToggleAtUnlock(waiting)).toBe(true);
    // A saved answer lists only the flags Unleash returned: one missing from it was off.
    STORE.setItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY, { 'another.rollout': true });
    expect(getMultichainFeatureToggleAtUnlock(waiting)).toBe(false);
    STORE.removeItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY);
    expect(getMultichainFeatureToggleAtUnlock(waiting)).toBe(false);
  });
});

describe('the backend for local testing', () => {
  const DEV_BACKEND = {
    url: 'http://192.168.0.10:8930',
    pins: {
      next: {
        network_id: 1777,
        native_token: 'aa'.repeat(32),
        service_view_pub: 'bb'.repeat(32),
        wire_format: 'v2',
      },
      transfer: null,
    },
  };
  const withBackend = ({ flag = true, devFlag = true } = {}) => {
    const base = state({ flag });
    return {
      ...base,
      featureToggles: { ...base.featureToggles, [MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE]: devFlag },
      multichain: { ...base.multichain, devBackend: DEV_BACKEND },
    };
  };

  test('is in force only with its own flag and the multichain flag on', () => {
    expect(getMultichainDevBackendFeatureToggle({ featureToggles: {} })).toBe(false);
    expect(selectDevBackend(withBackend())).toBe(DEV_BACKEND);
    expect(selectSideChainConfig(withBackend())).toMatchObject({
      client: 'backend',
      backendUrl: DEV_BACKEND.url,
    });
  });

  test('is ignored, saved but unused, with either flag off', () => {
    for (const flags of [{ devFlag: false }, { flag: false }]) {
      const s = withBackend(flags);
      expect(getMultichainDevBackendFeatureToggle(s)).toBe(false);
      expect(selectDevBackend(s)).toBeNull();
      expect(selectSideChainConfig(s)?.client).not.toBe('backend');
    }
  });
});

describe('the side chain setting', () => {
  test('shows with the flag on a network with a side chain', () => {
    expect(isSideChainAvailable(state())).toBe(true);
  });

  test('hides on a network without one', () => {
    expect(isSideChainAvailable(state({ network: 'testnet' }))).toBe(false);
  });

  test('hides with the flag off, or on mainnet', () => {
    expect(isSideChainAvailable(state({ flag: false }))).toBe(false);
    expect(isSideChainAvailable(state({ network: 'mainnet' }))).toBe(false);
  });

  test('is connected only where the user turned it on', () => {
    expect(isSideChainConnected(state())).toBe(true);
    expect(isSideChainConnected(state({ connected: false }))).toBe(false);
    expect(isSideChainConnected(state({ flag: false }))).toBe(false);
  });
});

describe('loading Hathor Next', () => {
  test('holds the app while the connected side chain is not ready', () => {
    expect(isWaitingForNext(state({ nextStatus: NEXT_STATUS.CONNECTING }))).toBe(true);
    expect(isWaitingForNext(state({ nextStatus: NEXT_STATUS.FAILED }))).toBe(true);
    expect(isWaitingForNext(state({ nextStatus: NEXT_STATUS.STOPPED }))).toBe(true);
    expect(isWaitingForNext(state())).toBe(false);
  });

  test('never holds it without the side chain', () => {
    expect(isWaitingForNext(state({ connected: false, nextStatus: NEXT_STATUS.STOPPED })))
      .toBe(false);
    expect(isWaitingForNext(state({ flag: false, nextStatus: NEXT_STATUS.STOPPED }))).toBe(false);
  });
});

describe('the token map', () => {
  test('carries HTR, and only while the side chain is connected', () => {
    expect(selectTokenMap(state())).toEqual([{ hathor: '00', next: '00' }]);
    expect(selectMappedNextId(state(), '00')).toBe('00');
    expect(selectMappedNextId(state(), 'abc')).toBeNull();
    expect(selectTokenMap(state({ connected: false }))).toEqual([]);
    expect(selectMappedNextId(state({ flag: false }), '00')).toBeNull();
  });

  test('transfers only from Hathor Network to Hathor Next so far', () => {
    const config = getSideChainConfig(FAKE_NETWORK);
    expect(canTransfer(config, CHAIN.HATHOR, CHAIN.HATHOR_NEXT)).toBe(true);
    expect(canTransfer(config, CHAIN.HATHOR_NEXT, CHAIN.HATHOR)).toBe(false);
    expect(canTransfer(null, CHAIN.HATHOR, CHAIN.HATHOR_NEXT)).toBe(false);
    expect(otherChain(CHAIN.HATHOR)).toBe(CHAIN.HATHOR_NEXT);
  });
});
