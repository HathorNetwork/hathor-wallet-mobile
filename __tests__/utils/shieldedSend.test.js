/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { constants } from '@hathor/wallet-lib';
import { DEFAULT_PRIVACY_MODE, PRIVACY_MODE } from '../../src/constants';
import {
  MAX_PRIVATE_AMOUNT,
  getPrivacyModeOptions,
  initialPrivacyMode,
  isPrivateAmountAllowed,
} from '../../src/utils/shieldedSend';

describe('getPrivacyModeOptions', () => {
  test('gives a legacy address only public sends', () => {
    expect(getPrivacyModeOptions(false)).toEqual([PRIVACY_MODE.PUBLIC]);
  });

  test('gives a private address only private sends', () => {
    expect(getPrivacyModeOptions(true)).toEqual([PRIVACY_MODE.HIDE_AMOUNT, PRIVACY_MODE.PRIVATE]);
  });
});

describe('initialPrivacyMode', () => {
  test('starts a send to a private address in the default mode, Hide amount', () => {
    expect(DEFAULT_PRIVACY_MODE).toBe(PRIVACY_MODE.HIDE_AMOUNT);
    expect(initialPrivacyMode(getPrivacyModeOptions(true))).toBe(PRIVACY_MODE.HIDE_AMOUNT);
  });

  test('starts a send to a legacy address in Public', () => {
    expect(initialPrivacyMode(getPrivacyModeOptions(false))).toBe(PRIVACY_MODE.PUBLIC);
  });

  test('takes a preferred mode only where the recipient can take it', () => {
    expect(initialPrivacyMode(getPrivacyModeOptions(true), PRIVACY_MODE.PRIVATE))
      .toBe(PRIVACY_MODE.PRIVATE);
    expect(initialPrivacyMode(getPrivacyModeOptions(true), PRIVACY_MODE.PUBLIC))
      .toBe(PRIVACY_MODE.HIDE_AMOUNT);
    expect(initialPrivacyMode(getPrivacyModeOptions(false), PRIVACY_MODE.PRIVATE))
      .toBe(PRIVACY_MODE.PUBLIC);
  });
});

describe('isPrivateAmountAllowed', () => {
  test('takes amounts below 2^40 base units', () => {
    expect(constants.MAX_SHIELDED_OUTPUT_VALUE).toBe(2n ** 40n);
    expect(MAX_PRIVATE_AMOUNT).toBe(2n ** 40n - 1n);
    expect(isPrivateAmountAllowed(1n)).toBe(true);
    expect(isPrivateAmountAllowed(2n ** 40n - 1n)).toBe(true);
  });

  test('refuses 2^40 base units and more, and zero', () => {
    expect(isPrivateAmountAllowed(2n ** 40n)).toBe(false);
    expect(isPrivateAmountAllowed(2n ** 41n)).toBe(false);
    expect(isPrivateAmountAllowed(0n)).toBe(false);
  });
});
