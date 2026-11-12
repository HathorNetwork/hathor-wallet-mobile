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
  MULTICHAIN_NETWORK_PRESET_FEATURE_TOGGLE,
  MULTICHAIN_TOKEN_CREATE_FEATURE_TOGGLE,
  PRE_SETTINGS_NEXT_DEVNET,
} from '../../src/constants';
import { canTransfer, CHAIN, getSideChainConfig, otherChain } from '../../src/multichain/chains';
import {
  canCreateNextTokens,
  getMultichainDevBackendFeatureToggle,
  getMultichainFeatureToggle,
  getMultichainFeatureToggleAtUnlock,
  getMultichainNetworkPresetFeatureToggle,
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

describe('the Hathor Next Devnet preset', () => {
  test("names devnet-alpha's hathor-core node and tx mining, with no wallet-service", () => {
    expect(PRE_SETTINGS_NEXT_DEVNET).toMatchObject({
      network: 'privatenet',
      fullNetwork: 'privatenet',
      nodeUrl: 'https://legacy-node.devnet-alpha.samba.hathor.network/v1a/',
      txMiningServiceUrl: 'https://tx-mining.devnet-alpha.samba.hathor.network/',
    });
    expect(PRE_SETTINGS_NEXT_DEVNET.walletServiceUrl).toBeUndefined();
  });

  test('shows only with its own flag', () => {
    expect(getMultichainNetworkPresetFeatureToggle({ featureToggles: {} })).toBe(false);
    expect(getMultichainNetworkPresetFeatureToggle({
      featureToggles: { [MULTICHAIN_NETWORK_PRESET_FEATURE_TOGGLE]: true },
    })).toBe(true);
  });
});

describe("devnet-alpha's side chain", () => {
  const DEVNET_NODE = PRE_SETTINGS_NEXT_DEVNET.nodeUrl;
  const NHTR = 'e5bcdd06b7d2b896fe194e09b55d687737af3767407d9efc957ac0ea84f1e54c';

  test("is its backend's, with the values the app pins", () => {
    const config = actualChains.getSideChainConfig('privatenet', null, DEVNET_NODE);
    expect(config).toMatchObject({
      client: 'backend',
      backendUrl: 'https://wallet-backend.devnet-alpha.samba.hathor.network',
      nextNetworkId: 1003,
      nativeTokenId: NHTR,
      serviceViewPub: 'b292d1f347dd954a23814d66d60adc6848d89e97f09be952bb2f5f9025fe2e0e',
      wireFormat: 'v3',
    });
    expect(config.transfer).toMatchObject({
      transfer_address: 'WScTqhLsBQnz3HMdQqh66JBgWqb255XffL',
      confirmations: 21,
      hathor_network: 'privatenet',
    });
    expect(BigInt(config.maxSendFee)).toBeGreaterThan(0n);
  });

  test('carries HTR to nHTR as one token, HTR on both chains', () => {
    const config = actualChains.getSideChainConfig('privatenet', null, DEVNET_NODE);
    expect(config.tokenMap).toEqual([{ hathor: '00', next: NHTR }]);
    expect(config.nativeTokenSymbol).toBe('HTR');
    expect(actualChains.transferReceiveSymbol(config, 'HTR')).toBe('HTR');
    expect(canTransfer(config, CHAIN.HATHOR, CHAIN.HATHOR_NEXT)).toBe(true);
    expect(actualChains.isTransferAddress('WScTqhLsBQnz3HMdQqh66JBgWqb255XffL', config)).toBe(true);
  });

  test('is known by the node, with or without its trailing slash', () => {
    expect(actualChains.getSideChainConfig('privatenet', null, DEVNET_NODE.replace(/\/$/, '')))
      .toMatchObject({ client: 'backend' });
  });

  test("is no other privatenet's", () => {
    expect(actualChains.getSideChainConfig('privatenet', null, 'http://192.168.0.10:8080/v1a/'))
      .toBeNull();
  });

  test('gives way to a backend set for local testing', () => {
    const devBackend = {
      url: 'http://192.168.0.10:8930',
      pins: { next: { network_id: 1777, native_token: '00' }, transfer: null },
    };
    expect(actualChains.getSideChainConfig('privatenet', devBackend, DEVNET_NODE))
      .toMatchObject({ backendUrl: 'http://192.168.0.10:8930' });
  });

  test('waits, like every side chain, for the wallet to know its network', () => {
    expect(actualChains.getSideChainConfig(null, null, DEVNET_NODE)).toBeNull();
  });

  test('shows "Connect to side chain" there with the multichain flag alone', () => {
    const devnet = {
      ...state({ network: 'privatenet', connected: false }),
      networkSettings: PRE_SETTINGS_NEXT_DEVNET,
    };
    expect(isSideChainAvailable(devnet)).toBe(true);
    expect(isSideChainAvailable({ ...devnet, featureToggles: {} })).toBe(false);
  });
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

describe('creating a token on Hathor Next', () => {
  const ready = (options = {}, { tokenFlag = true, canCreate = true } = {}) => {
    const s = state(options);
    return {
      ...s,
      featureToggles: { ...s.featureToggles, [MULTICHAIN_TOKEN_CREATE_FEATURE_TOGGLE]: tokenFlag },
      multichain: { ...s.multichain, next: { ...s.multichain.next, canCreateTokens: canCreate } },
    };
  };

  test('shows with its flag, Hathor Next ready, and a backend that creates tokens', () => {
    expect(canCreateNextTokens(ready())).toBe(true);
  });

  test('hides with either flag off: its own is off unless Unleash returns it', () => {
    expect(canCreateNextTokens(ready({}, { tokenFlag: false }))).toBe(false);
    expect(canCreateNextTokens(ready({ flag: false }))).toBe(false);
    expect(canCreateNextTokens({
      ...ready(),
      featureToggles: { [MULTICHAIN_FEATURE_TOGGLE]: true },
    })).toBe(false);
  });

  test('hides until Hathor Next is ready, connected, and its backend creates tokens', () => {
    expect(canCreateNextTokens(ready({ nextStatus: NEXT_STATUS.CONNECTING }))).toBe(false);
    expect(canCreateNextTokens(ready({ connected: false }))).toBe(false);
    expect(canCreateNextTokens(ready({}, { canCreate: false }))).toBe(false);
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
