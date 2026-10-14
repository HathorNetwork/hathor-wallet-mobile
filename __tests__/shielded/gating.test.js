/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import {
  FEATURE_TOGGLE_DEFAULTS,
  PRE_SETTINGS_MAINNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  PRE_SETTINGS_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import {
  getShieldedFeatureToggle,
  isShieldedAvailable,
  isShieldedEnabled,
  isShieldedEnvironment,
  isShieldedNetwork,
  isShieldedNetworkName,
  selectShieldedCapability,
  shouldRegisterShieldedProvider,
} from '../../src/shielded/gating';

// A network saved from the Customize form takes its fullNetwork from the node. The public
// testnet and the shielded testnet share their genesis, so only this name tells them apart.
const customNetwork = (fullNetwork) => ({
  stage: 'testnet',
  network: 'testnet',
  fullNetwork,
  nodeUrl: 'https://node.example/v1a/',
  explorerUrl: 'https://explorer.example/',
  explorerServiceUrl: 'https://explorer-service.example/',
  txMiningServiceUrl: 'https://txmining.example/',
  walletServiceUrl: '',
  walletServiceWsUrl: '',
});

describe('the Shielded Testnet preset', () => {
  test('names the shielded testnet and its wallet-service', () => {
    expect(PRE_SETTINGS_SHIELDED_TESTNET).toEqual({
      stage: 'testnet',
      network: 'testnet',
      fullNetwork: 'testnet-shielded-outputs',
      walletServiceUrl: 'https://wallet-service.shielded-outputs.testnet.hathor.network/',
      walletServiceWsUrl: 'wss://ws.wallet-service.shielded-outputs.testnet.hathor.network/',
      nodeUrl: 'https://node1.shielded-outputs.testnet.hathor.network/v1a/',
      explorerUrl: 'https://explorer.shielded-outputs.testnet.hathor.network/',
      explorerServiceUrl: 'https://explorer-service.shielded-outputs.testnet.hathor.network/',
      txMiningServiceUrl: 'https://txmining.shielded-outputs.testnet.hathor.network/',
    });
  });
});

describe('isShieldedNetworkName', () => {
  test('is true only for the name the shielded testnet nodes report', () => {
    expect(isShieldedNetworkName('testnet-shielded-outputs')).toBe(true);
    expect(isShieldedNetworkName('testnet-india')).toBe(false);
    expect(isShieldedNetworkName('testnet')).toBe(false);
    expect(isShieldedNetworkName('mainnet')).toBe(false);
    expect(isShieldedNetworkName('')).toBe(false);
    expect(isShieldedNetworkName(null)).toBe(false);
    expect(isShieldedNetworkName(undefined)).toBe(false);
  });
});

describe('isShieldedNetwork', () => {
  test('is true for the Shielded Testnet preset', () => {
    expect(isShieldedNetwork(PRE_SETTINGS_SHIELDED_TESTNET)).toBe(true);
  });

  test('is false for the Mainnet and Testnet presets', () => {
    expect(isShieldedNetwork(PRE_SETTINGS_MAINNET)).toBe(false);
    expect(isShieldedNetwork(PRE_SETTINGS_TESTNET)).toBe(false);
  });

  test('follows the fullNetwork of a custom network', () => {
    expect(isShieldedNetwork(customNetwork('testnet-shielded-outputs'))).toBe(true);
    expect(isShieldedNetwork(customNetwork('testnet-india'))).toBe(false);
    expect(isShieldedNetwork(customNetwork('privatenet'))).toBe(false);
  });

  test('is false without network settings', () => {
    expect(isShieldedNetwork(null)).toBe(false);
    expect(isShieldedNetwork(undefined)).toBe(false);
    expect(isShieldedNetwork({})).toBe(false);
  });
});

describe('getShieldedFeatureToggle', () => {
  test('is the shielded-outputs rollout flag, off by default', () => {
    expect(SHIELDED_OUTPUTS_FEATURE_TOGGLE).toBe('shielded-outputs.rollout');
    expect(FEATURE_TOGGLE_DEFAULTS[SHIELDED_OUTPUTS_FEATURE_TOGGLE]).toBe(false);
    expect(getShieldedFeatureToggle({ featureToggles: { ...FEATURE_TOGGLE_DEFAULTS } }))
      .toBe(false);
  });

  test('is off when Unleash does not return the flag', () => {
    expect(getShieldedFeatureToggle({ featureToggles: {} })).toBe(false);
  });

  test('follows the flag', () => {
    expect(getShieldedFeatureToggle({
      featureToggles: { [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: true },
    })).toBe(true);
    expect(getShieldedFeatureToggle({
      featureToggles: { [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: false },
    })).toBe(false);
  });
});

describe('shouldRegisterShieldedProvider', () => {
  const seedWallet = { useWalletService: false, isPasskeyWallet: false };

  test('registers for a seed wallet on the fullnode facade on the shielded testnet', () => {
    expect(shouldRegisterShieldedProvider({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      ...seedWallet,
    })).toBe(true);
    expect(shouldRegisterShieldedProvider({
      networkSettings: customNetwork('testnet-shielded-outputs'),
      ...seedWallet,
    })).toBe(true);
  });

  test('never registers on another network', () => {
    for (const networkSettings of [
      PRE_SETTINGS_MAINNET,
      PRE_SETTINGS_TESTNET,
      customNetwork('testnet-india'),
      customNetwork('privatenet'),
    ]) {
      expect(shouldRegisterShieldedProvider({ networkSettings, ...seedWallet })).toBe(false);
    }
  });

  test('registers for a seed wallet on the wallet-service facade on the shielded testnet', () => {
    expect(shouldRegisterShieldedProvider({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      useWalletService: true,
      isPasskeyWallet: false,
    })).toBe(true);
  });

  test('never registers for a passkey wallet, on either facade', () => {
    expect(shouldRegisterShieldedProvider({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      useWalletService: true,
      isPasskeyWallet: true,
    })).toBe(false);
    expect(shouldRegisterShieldedProvider({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      useWalletService: false,
      isPasskeyWallet: true,
    })).toBe(false);
  });
});

describe('the shielded gates', () => {
  const capability = (level) => ({
    level,
    reason: level === 'full' ? null : 'locked',
    cause: null,
    canReceive: level === 'view' || level === 'full',
    canSpend: level === 'full',
    historyComplete: true,
    undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
  });

  // A seed wallet on the shielded testnet, with the flag on and a provider that passed.
  const state = (overrides = {}) => {
    const { shielded, ...rest } = overrides;
    return {
      featureToggles: { [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: true },
      useWalletService: false,
      fullNodeNetworkName: 'testnet-shielded-outputs',
      ...rest,
      shielded: {
        providerStatus: SHIELDED_PROVIDER_STATUS.READY,
        providerError: null,
        capability: capability('full'),
        ...shielded,
      },
    };
  };

  test('selectShieldedCapability reads the capability the wallet reported', () => {
    expect(selectShieldedCapability(state())).toEqual(capability('full'));
    expect(selectShieldedCapability(state({ shielded: { capability: null } }))).toBeNull();
  });

  test('all pass for a seed wallet on the shielded testnet with the flag on', () => {
    expect(isShieldedEnvironment(state())).toBe(true);
    expect(isShieldedAvailable(state())).toBe(true);
    expect(isShieldedEnabled(state())).toBe(true);
  });

  test.each([
    ['the flag is off', { featureToggles: { [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: false } }],
    ['Unleash does not return the flag', { featureToggles: {} }],
    ['the node reports the public testnet', { fullNodeNetworkName: 'testnet-india' }],
    ['the node reports mainnet', { fullNodeNetworkName: 'mainnet' }],
    ['the network name is not known yet', { fullNodeNetworkName: null }],
    ['no provider was registered', {
      shielded: { providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED },
    }],
  ])('all fail when %s', (_label, overrides) => {
    expect(isShieldedEnvironment(state(overrides))).toBe(false);
    expect(isShieldedAvailable(state(overrides))).toBe(false);
    expect(isShieldedEnabled(state(overrides))).toBe(false);
  });

  test('all pass for a seed wallet on the wallet-service facade on the shielded testnet', () => {
    const onWalletService = state({ useWalletService: true });
    expect(isShieldedEnvironment(onWalletService)).toBe(true);
    expect(isShieldedAvailable(onWalletService)).toBe(true);
    expect(isShieldedEnabled(onWalletService)).toBe(true);
  });

  test('only the environment passes when the provider failed its self-test', () => {
    const failed = state({
      shielded: { providerStatus: SHIELDED_PROVIDER_STATUS.FAILED, providerError: 'timeout' },
    });
    expect(isShieldedEnvironment(failed)).toBe(true);
    expect(isShieldedAvailable(failed)).toBe(false);
    expect(isShieldedEnabled(failed)).toBe(false);
  });

  test.each([
    ['none', false],
    ['watch', false],
    ['view', true],
    ['full', true],
  ])('isShieldedEnabled at level %s is %s', (level, enabled) => {
    const at = state({ shielded: { capability: capability(level) } });
    expect(isShieldedAvailable(at)).toBe(true);
    expect(isShieldedEnabled(at)).toBe(enabled);
  });

  test('isShieldedEnabled is false before the wallet reports a capability', () => {
    const before = state({ shielded: { capability: null } });
    expect(isShieldedAvailable(before)).toBe(true);
    expect(isShieldedEnabled(before)).toBe(false);
  });

  test('flipping the flag changes only the gates, not the registration', () => {
    const settings = { networkSettings: PRE_SETTINGS_SHIELDED_TESTNET };
    const seed = { useWalletService: false, isPasskeyWallet: false };
    const off = state({ featureToggles: { [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: false } });
    expect(isShieldedEnvironment(off)).toBe(false);
    expect(shouldRegisterShieldedProvider({ ...settings, ...seed })).toBe(true);
  });
});
