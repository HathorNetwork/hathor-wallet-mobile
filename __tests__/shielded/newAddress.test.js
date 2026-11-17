/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { errors } from '@hathor/wallet-lib';
import { newAddressErrorText } from '../../src/shielded/newAddress';

const refusal = (code) => new errors.ShieldedKeyError(code, `refused: ${code}`);

describe('newAddressErrorText', () => {
  test('asks to unlock a scan key that is locked', () => {
    expect(newAddressErrorText(refusal('shielded-locked')))
      .toBe('Your private balance is locked. Unlock it and try again.');
  });

  test('says the device could not load private transfers without a crypto provider', () => {
    expect(newAddressErrorText(refusal('shielded-no-provider')))
      .toBe('Private transfers could not be loaded on this device.');
  });

  test.each([
    'shielded-no-keys',
    'shielded-integrity',
    'shielded-multisig',
    'shielded-not-started',
  ])('says private transfers are not available for the refusal %s', (code) => {
    expect(newAddressErrorText(refusal(code)))
      .toBe('Private transfers are not available for this wallet.');
  });

  test('gives no copy for other errors', () => {
    expect(newAddressErrorText(new Error('Wallet not ready'))).toBeNull();
    expect(newAddressErrorText(undefined)).toBeNull();
  });
});
