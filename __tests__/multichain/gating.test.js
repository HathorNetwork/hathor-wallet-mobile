/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import {
  FULL_NETWORK_JULIET_TESTNET,
  MULTICHAIN_FEATURE_TOGGLE,
  MULTICHAIN_NETWORK_PRESET_FEATURE_TOGGLE,
  PRE_SETTINGS_JULIET_TESTNET,
} from '../../src/constants';
import { canTransfer, CHAIN, getSideChainConfig, otherChain } from '../../src/multichain/chains';
import {
  getMultichainFeatureToggle,
  getMultichainNetworkPresetFeatureToggle,
  isSideChainAvailable,
  isSideChainConnected,
  isSideChainSimulated,
  isWaitingForNext,
  selectMappedNextId,
  selectTokenMap,
} from '../../src/multichain/gating';
import { MULTICHAIN_INITIAL_STATE, NEXT_STATUS } from '../../src/multichain/state';

const state = ({
  flag = true,
  network = FULL_NETWORK_JULIET_TESTNET,
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

describe('the Testnet Juliet preset', () => {
  test('names testnet-juliet, with no wallet-service', () => {
    expect(PRE_SETTINGS_JULIET_TESTNET.fullNetwork).toBe('testnet-juliet');
    expect(PRE_SETTINGS_JULIET_TESTNET.walletServiceUrl).toBeUndefined();
  });
});

describe('getSideChainConfig', () => {
  test('gives Juliet Hathor Next, native HTR, simulated while the client is the mock', () => {
    expect(getSideChainConfig(FULL_NETWORK_JULIET_TESTNET)).toMatchObject({
      id: CHAIN.HATHOR_NEXT,
      name: 'Hathor Next',
      nativeTokenId: '00',
      nativeTokenSymbol: 'HTR',
      simulated: true,
    });
  });

  test('gives every testnet a simulated side chain while the client is the mock', () => {
    expect(getSideChainConfig('testnet-hotel')).toMatchObject({ simulated: true });
  });

  test('never gives mainnet a side chain', () => {
    expect(getSideChainConfig('mainnet')).toBeNull();
  });

  test('gives no side chain before the wallet knows its network', () => {
    expect(getSideChainConfig(null)).toBeNull();
  });
});

describe('the flags', () => {
  test('are off unless Unleash returns them', () => {
    expect(getMultichainFeatureToggle({ featureToggles: {} })).toBe(false);
    expect(getMultichainNetworkPresetFeatureToggle({ featureToggles: {} })).toBe(false);
    expect(getMultichainNetworkPresetFeatureToggle({
      featureToggles: { [MULTICHAIN_NETWORK_PRESET_FEATURE_TOGGLE]: true },
    })).toBe(true);
  });
});

describe('the side chain setting', () => {
  test('shows with the flag on a network with a side chain', () => {
    expect(isSideChainAvailable(state())).toBe(true);
    expect(isSideChainSimulated(state())).toBe(true);
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
    const config = getSideChainConfig(FULL_NETWORK_JULIET_TESTNET);
    expect(canTransfer(config, CHAIN.HATHOR, CHAIN.HATHOR_NEXT)).toBe(true);
    expect(canTransfer(config, CHAIN.HATHOR_NEXT, CHAIN.HATHOR)).toBe(false);
    expect(canTransfer(null, CHAIN.HATHOR, CHAIN.HATHOR_NEXT)).toBe(false);
    expect(otherChain(CHAIN.HATHOR)).toBe(CHAIN.HATHOR_NEXT);
  });
});
