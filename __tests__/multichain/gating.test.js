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
import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import {
  MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE,
  MULTICHAIN_FEATURE_TOGGLE,
  MULTICHAIN_NETWORK_PRESET_FEATURE_TOGGLE,
  MULTICHAIN_TOKEN_CREATE_FEATURE_TOGGLE,
  PRE_SETTINGS_NEXT_TESTNET,
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

describe('the Hathor Next Testnet preset', () => {
  test("names testnet-juliet's node, tx mining, wallet-service and explorer", () => {
    expect(PRE_SETTINGS_NEXT_TESTNET).toMatchObject({
      network: 'testnet',
      fullNetwork: 'testnet-juliet',
      nodeUrl: 'https://legacy-node.testnet-alpha.samba.hathor.network/v1a/',
      txMiningServiceUrl: 'https://tx-mining.testnet-alpha.samba.hathor.network/',
      walletServiceUrl: 'https://legacy-wallet-service.testnet-alpha.samba.hathor.network/',
      walletServiceWsUrl: 'wss://legacy-wallet-service-ws.testnet-alpha.samba.hathor.network/',
      explorerUrl: 'https://legacy-explorer.testnet-alpha.samba.hathor.network/',
    });
  });

  test('shows only with its own flag', () => {
    expect(getMultichainNetworkPresetFeatureToggle({ featureToggles: {} })).toBe(false);
    expect(getMultichainNetworkPresetFeatureToggle({
      featureToggles: { [MULTICHAIN_NETWORK_PRESET_FEATURE_TOGGLE]: true },
    })).toBe(true);
  });
});

describe("testnet-alpha's side chain", () => {
  const TESTNET_NODE = PRE_SETTINGS_NEXT_TESTNET.nodeUrl;
  const USDT = 'd957d448377de9c9d313d545398677cd6df99ac051dcf2afcd1b38dcb22f92d8';
  const NHTR = '664cf15052b6f66f1f06ac32189381a27f1bfe1eda2f77cea4fde760b5884d33';

  test("is its backend's, with the values the app pins", () => {
    const config = actualChains.getSideChainConfig('testnet-juliet', null, TESTNET_NODE);
    expect(config).toMatchObject({
      client: 'backend',
      backendUrl: 'https://wallet-backend.testnet-alpha.samba.hathor.network',
      nextNetworkId: 1004,
      nativeTokenId: USDT,
      serviceViewPub: 'ee29df21a6c64fe43fc8ec6cd7b8c1ecfc4c89eec9370086129e367693bbf400',
      wireFormat: 'v3',
      explorerUrl: 'https://samba.explorer.hathor.dev/',
    });
    expect(config.transfer).toMatchObject({
      transfer_address: 'WScTqhLsBQnz3HMdQqh66JBgWqb255XffL',
      confirmations: 21,
      hathor_network: 'testnet-juliet',
      mint_token: NHTR,
    });
    expect(BigInt(config.maxSendFee)).toBeGreaterThan(0n);
  });

  test('carries HTR to nHTR as one token, HTR on both chains, and USDT apart', () => {
    const config = actualChains.getSideChainConfig('testnet-juliet', null, TESTNET_NODE);
    expect(config.tokenMap).toEqual([{ hathor: '00', next: NHTR }]);
    expect(config.nativeTokenSymbol).toBe('USDT');
    expect(actualChains.transferReceiveSymbol(config, 'HTR')).toBe('HTR');
    expect(canTransfer(config, CHAIN.HATHOR, CHAIN.HATHOR_NEXT)).toBe(true);
    expect(actualChains.isTransferAddress('WScTqhLsBQnz3HMdQqh66JBgWqb255XffL', config)).toBe(true);
  });

  test('refuses the P2SH address of a transfer address\'s hash too', () => {
    const net = new Network('testnet');
    const hash = new Address('WScTqhLsBQnz3HMdQqh66JBgWqb255XffL', { network: net })
      .decode().subarray(1, 21);
    const p2sh = helpersUtils.encodeAddressP2SH(hash, net).base58;
    expect(p2sh).not.toBe('WScTqhLsBQnz3HMdQqh66JBgWqb255XffL');
    expect(actualChains.isTransferAddress(p2sh, null)).toBe(true);
  });

  test('is known by the name its node reports, through any node', () => {
    expect(actualChains.getSideChainConfig('testnet-juliet', null, 'http://192.168.0.10:8080/v1a/'))
      .toMatchObject({ client: 'backend', nextNetworkId: 1004 });
    expect(actualChains.getSideChainConfig('testnet-juliet', null, null))
      .toMatchObject({ client: 'backend', nextNetworkId: 1004 });
  });

  test("is no other network's, through its node or any other", () => {
    expect(actualChains.getSideChainConfig('privatenet', null, TESTNET_NODE)).toBeNull();
    expect(actualChains.getSideChainConfig('testnet-india', null, TESTNET_NODE)).toBeNull();
    expect(actualChains.getSideChainConfig('privatenet', null, 'http://192.168.0.10:8080/v1a/'))
      .toBeNull();
  });

  test('gives way to a backend set for local testing', () => {
    const devBackend = {
      url: 'http://192.168.0.10:8930',
      pins: { next: { network_id: 1777, native_token: '00' }, transfer: null },
    };
    expect(actualChains.getSideChainConfig('testnet-juliet', devBackend, TESTNET_NODE))
      .toMatchObject({ backendUrl: 'http://192.168.0.10:8930' });
  });

  test('waits, like every side chain, for the wallet to know its network', () => {
    expect(actualChains.getSideChainConfig(null, null, TESTNET_NODE)).toBeNull();
  });

  test('shows "Connect to side chain" there with the multichain flag alone', () => {
    const testnet = {
      ...state({ network: 'testnet-juliet', connected: false }),
      networkSettings: PRE_SETTINGS_NEXT_TESTNET,
    };
    expect(isSideChainAvailable(testnet)).toBe(true);
    expect(isSideChainAvailable({ ...testnet, featureToggles: {} })).toBe(false);
  });
});

describe("the chain transfer's address", () => {
  // hathor-next's plan, docs/plan/chain-transfer-testnet-one-way.md §3.3: the hash of a label,
  // not of a key, so no key spends from it.
  test('is the plan\'s: hash160 of its testnet label, as a testnet address, and the only one', () => {
    const hash = ripemd160(sha256(utf8ToBytes('hathor/chain-transfer/testnet-v1')));
    expect(bytesToHex(hash)).toBe('2b33ad1665287315391f434b5d6b894302602f5d');
    const address = helpersUtils.encodeAddress(Buffer.from(hash), new Network('testnet')).base58;
    expect(address).toBe('WScTqhLsBQnz3HMdQqh66JBgWqb255XffL');
    expect(actualChains.KNOWN_TRANSFER_ADDRESSES).toEqual([address]);
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

describe('a side chain on the real pins', () => {
  const TESTNET = 'https://legacy-node.testnet-alpha.samba.hathor.network/v1a/';
  const local = { url: 'http://192.168.0.10:8930', pins: { next: {}, transfer: null } };

  test('is none on mainnet, even with the testnet\'s node or a backend for local testing', () => {
    // A mainnet wallet service names the network mainnet; the node was pointed at the testnet.
    expect(actualChains.getSideChainConfig('mainnet', null, TESTNET)).toBeNull();
    expect(actualChains.getSideChainConfig('mainnet', local, TESTNET)).toBeNull();
    expect(actualChains.getSideChainConfig('mainnet', local, null)).toBeNull();
  });

  test('is none on a network other than the one it names', () => {
    expect(actualChains.getSideChainConfig('testnet-juliet', null, TESTNET)).not.toBeNull();
    expect(actualChains.getSideChainConfig('testnet', null, TESTNET)).toBeNull();
  });

  test('refuses, in its place, a backend for local testing that passes as one holding value', () => {
    // testnet-alpha's own values, given by a backend set for local testing.
    const devBackend = () => ({
      url: 'http://192.168.0.10:8930',
      pins: {
        next: {
          network_id: 1004,
          native_token: 'd957d448377de9c9d313d545398677cd6df99ac051dcf2afcd1b38dcb22f92d8',
          service_view_pub: 'ee29df21a6c64fe43fc8ec6cd7b8c1ecfc4c89eec9370086129e367693bbf400',
          wire_format: 'v3',
        },
        transfer: null,
      },
    });
    expect(actualChains.getSideChainConfig('testnet-juliet', devBackend(), TESTNET)).not.toBeNull();
    // Were testnet-alpha to hold value, that backend would be no side chain at all.
    const pinned = actualChains.getSideChainConfig('testnet-juliet', null, TESTNET);
    pinned.holdsValue = true;
    try {
      expect(actualChains.getSideChainConfig('testnet-juliet', devBackend(), TESTNET)).toBeNull();
    } finally {
      pinned.holdsValue = false;
    }
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
