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
} from '../../src/constants';
import {
  getShieldedFeatureToggle,
  isShieldedNetwork,
  isShieldedNetworkName,
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
  test('names the shielded testnet and has no wallet-service', () => {
    expect(PRE_SETTINGS_SHIELDED_TESTNET).toEqual({
      stage: 'testnet',
      network: 'testnet',
      fullNetwork: 'testnet-shielded-outputs',
      walletServiceUrl: null,
      walletServiceWsUrl: null,
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
  test('defaults to off', () => {
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

  test('never registers on the wallet-service facade or for a passkey wallet', () => {
    expect(shouldRegisterShieldedProvider({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      useWalletService: true,
      isPasskeyWallet: false,
    })).toBe(false);
    expect(shouldRegisterShieldedProvider({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      useWalletService: false,
      isPasskeyWallet: true,
    })).toBe(false);
  });
});
