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
import { Address, Network, helpersUtils } from '@hathor/wallet-lib';
import {
  MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE,
  MULTICHAIN_FEATURE_TOGGLE,
  MULTICHAIN_NETWORK_PRESET_FEATURE_TOGGLE,
  PRE_SETTINGS_NEXT_DEVNET,
} from '../../src/constants';
import { canTransfer, CHAIN, getSideChainConfig, otherChain } from '../../src/multichain/chains';
import {
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

afterEach(() => {
  jest.restoreAllMocks();
});

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

  test('refuses the P2SH address of a transfer address\'s hash too', () => {
    const net = new Network('privatenet');
    const hash = new Address('WScTqhLsBQnz3HMdQqh66JBgWqb255XffL', { network: net })
      .decode().subarray(1, 21);
    const p2sh = helpersUtils.encodeAddressP2SH(hash, net).base58;
    expect(p2sh).not.toBe('WScTqhLsBQnz3HMdQqh66JBgWqb255XffL');
    expect(actualChains.isTransferAddress(p2sh, null)).toBe(true);
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

describe('mainnet', () => {
  test('has no side chain, whatever names one', () => {
    expect(actualChains.getSideChainConfig('mainnet')).toBeNull();
  });

  test("keeps the flag off with mainnet's network settings, whatever Unleash says", () => {
    const onMainnet = { ...state(), networkSettings: { network: 'mainnet' } };
    expect(getMultichainFeatureToggle(onMainnet)).toBe(false);
    expect(isSideChainAvailable(onMainnet)).toBe(false);
    expect(isSideChainConnected(onMainnet)).toBe(false);
    expect(isWaitingForNext(onMainnet)).toBe(false);
    // Another network's settings leave the flag to Unleash.
    expect(getMultichainFeatureToggle({ ...state(), networkSettings: { network: 'testnet' } }))
      .toBe(true);
  });
});

describe('the side chain setting, saved', () => {
  test('counts only its own keys, set to true', () => {
    const base = state({ connected: false });
    const withMap = (connectedNetworks) => ({
      ...base, multichain: { ...base.multichain, connectedNetworks },
    });
    expect(isSideChainConnected(withMap(Object.create({ [FAKE_NETWORK]: true })))).toBe(false);
    expect(isSideChainConnected(withMap({ [FAKE_NETWORK]: 'yes' }))).toBe(false);
    expect(isSideChainConnected(withMap({ [FAKE_NETWORK]: true }))).toBe(true);
  });

  test('gives a name such as constructor no side chain', () => {
    for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(actualChains.getSideChainConfig(name)).toBeNull();
    }
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

describe('a side chain on the real pins', () => {
  const DEVNET = 'https://legacy-node.devnet-alpha.samba.hathor.network/v1a/';
  const local = { url: 'http://192.168.0.10:8930', pins: { next: {}, transfer: null } };

  test('is none on mainnet, even with the devnet\'s node or a backend for local testing', () => {
    // A mainnet wallet service names the network mainnet; the node was pointed at the devnet.
    expect(actualChains.getSideChainConfig('mainnet', null, DEVNET)).toBeNull();
    expect(actualChains.getSideChainConfig('mainnet', local, DEVNET)).toBeNull();
    expect(actualChains.getSideChainConfig('mainnet', local, null)).toBeNull();
  });

  test('is none on a network other than the one it names', () => {
    expect(actualChains.getSideChainConfig('privatenet', null, DEVNET)).not.toBeNull();
    expect(actualChains.getSideChainConfig('testnet', null, DEVNET)).toBeNull();
  });

  test('is never one a backend for local testing could pass as, once its network holds value', () => {
    const valued = {
      holdsValue: true, nextNetworkId: 7, nativeTokenId: 'aa'.repeat(32), serviceViewPub: 'bb'.repeat(32),
    };
    const pins = (next) => ({ next: { network_id: 1, native_token: 'cc'.repeat(32), service_view_pub: 'dd'.repeat(32), ...next } });
    expect(actualChains.impersonatedSideChain(pins({ network_id: 7 }), [valued])).toBe(valued);
    expect(actualChains.impersonatedSideChain(pins({ native_token: 'aa'.repeat(32) }), [valued]))
      .toBe(valued);
    expect(actualChains.impersonatedSideChain(pins({ service_view_pub: 'bb'.repeat(32) }), [valued]))
      .toBe(valued);
    expect(actualChains.impersonatedSideChain(pins({}), [valued])).toBeNull();
    const playMoney = { ...valued, holdsValue: false };
    expect(actualChains.impersonatedSideChain(pins({ network_id: 7 }), [playMoney])).toBeNull();
    // None of the pinned networks holds value yet.
    expect(actualChains.impersonatedSideChain(pins({ network_id: 1003 }))).toBeNull();
  });
});
