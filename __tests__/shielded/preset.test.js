/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import {
  PRE_SETTINGS_MAINNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  PRE_SETTINGS_TESTNET,
} from '../../src/constants';
import { migrateShieldedTestnetPreset } from '../../src/shielded/preset';

// The shielded testnet preset as the versions before its wallet-service saved it.
const OLD_PRESET = {
  ...PRE_SETTINGS_SHIELDED_TESTNET,
  walletServiceUrl: null,
  walletServiceWsUrl: null,
};

describe('migrateShieldedTestnetPreset', () => {
  test('fills the wallet-service URLs into the preset an older version saved', () => {
    expect(migrateShieldedTestnetPreset(OLD_PRESET)).toEqual(PRE_SETTINGS_SHIELDED_TESTNET);
    expect(PRE_SETTINGS_SHIELDED_TESTNET.walletServiceUrl)
      .toBe('https://wallet-service.shielded-outputs.testnet.hathor.network/');
    expect(PRE_SETTINGS_SHIELDED_TESTNET.walletServiceWsUrl)
      .toBe('wss://ws.wallet-service.shielded-outputs.testnet.hathor.network/');
  });

  test('changes nothing in the preset this version saves', () => {
    expect(migrateShieldedTestnetPreset(PRE_SETTINGS_SHIELDED_TESTNET)).toBeNull();
  });

  test.each([
    ['nothing saved', null],
    ['mainnet', PRE_SETTINGS_MAINNET],
    ['the public testnet', PRE_SETTINGS_TESTNET],
    ['a custom network on the shielded testnet without a wallet-service', {
      ...PRE_SETTINGS_SHIELDED_TESTNET,
      walletServiceUrl: '',
      walletServiceWsUrl: '',
    }],
    ['a custom network on another node of the shielded testnet', {
      ...OLD_PRESET,
      nodeUrl: 'https://node.example/v1a/',
    }],
    ['a custom network with its own wallet-service', {
      ...PRE_SETTINGS_SHIELDED_TESTNET,
      walletServiceUrl: 'https://wallet-service.example/',
      walletServiceWsUrl: 'wss://ws.wallet-service.example/',
    }],
  ])('leaves %s as it is', (_label, settings) => {
    expect(migrateShieldedTestnetPreset(settings)).toBeNull();
  });
});
