/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import {
  DEFAULT_PRIVACY_MODE,
  PRE_SETTINGS_MAINNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  PRE_SETTINGS_TESTNET,
  PRIVACY_MODE,
  privacyDefaultModeKey,
} from '../../src/constants';
import {
  PRIVACY_DEFAULT_MODE_OPTIONS,
  normalizePrivacyDefaultMode,
} from '../../src/utils/privacy';

describe('the default privacy mode', () => {
  test('can only be a mode of a send to a private address, Hide amount by default', () => {
    expect(PRIVACY_DEFAULT_MODE_OPTIONS).toEqual([PRIVACY_MODE.HIDE_AMOUNT, PRIVACY_MODE.PRIVATE]);
    expect(DEFAULT_PRIVACY_MODE).toBe(PRIVACY_MODE.HIDE_AMOUNT);
  });

  test.each([
    PRIVACY_MODE.HIDE_AMOUNT,
    PRIVACY_MODE.PRIVATE,
  ])('keeps a stored %s', (mode) => {
    expect(normalizePrivacyDefaultMode(mode)).toBe(mode);
  });

  test.each([
    ['Public, which no send to a private address takes', PRIVACY_MODE.PUBLIC],
    ['nothing stored', null],
    ['undefined', undefined],
    ['an unknown mode', 'garbage'],
    ['a number', 1],
    ['an object', { mode: PRIVACY_MODE.PRIVATE }],
  ])('turns %s into the default', (_label, value) => {
    expect(normalizePrivacyDefaultMode(value)).toBe(DEFAULT_PRIVACY_MODE);
  });
});

describe('privacyDefaultModeKey', () => {
  test('keys the default by the full network name, so the two testnets keep their own', () => {
    expect(privacyDefaultModeKey(PRE_SETTINGS_SHIELDED_TESTNET))
      .toBe('wallet:privacy_default_mode:testnet-shielded-outputs');
    expect(privacyDefaultModeKey(PRE_SETTINGS_TESTNET))
      .toBe('wallet:privacy_default_mode:testnet');
    expect(privacyDefaultModeKey(PRE_SETTINGS_MAINNET))
      .toBe('wallet:privacy_default_mode:mainnet');
    // Both testnets report the network 'testnet'.
    expect(PRE_SETTINGS_SHIELDED_TESTNET.network).toBe(PRE_SETTINGS_TESTNET.network);
  });

  test('falls back to the network of settings saved without a full network name', () => {
    const { fullNetwork, ...settings } = PRE_SETTINGS_TESTNET;
    expect(fullNetwork).toBe('testnet');

    expect(privacyDefaultModeKey(settings)).toBe('wallet:privacy_default_mode:testnet');
  });

  test('starts with the prefix a wallet reset clears', () => {
    expect(privacyDefaultModeKey(PRE_SETTINGS_SHIELDED_TESTNET).startsWith('wallet:')).toBe(true);
  });
});
