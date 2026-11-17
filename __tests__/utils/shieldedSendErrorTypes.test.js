/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';

// A wallet-lib build without the error classes of private sends: the mapping must not need them.
jest.mock('@hathor/wallet-lib', () => {
  const actual = jest.requireActual('@hathor/wallet-lib');
  return {
    ...actual,
    errors: {
      ...actual.errors,
      ShieldedKeyError: undefined,
      ShieldedChangeUnavailableError: undefined,
      InputLimitError: undefined,
    },
  };
});

/* eslint-disable import/first */
import { mapShieldedSendError } from '../../src/utils/shieldedSend';
import { mapTxError } from '../../src/screens/SendConfirmScreen';
/* eslint-enable import/first */

describe('mapShieldedSendError without the error classes of private sends', () => {
  test('maps by the message', () => {
    expect(mapShieldedSendError(new Error('Shielded output 2: value must be in [1, 2^40)')))
      .toBe('An amount in this transaction, its change included, is too large to be private.');
    expect(mapShieldedSendError(new Error('A shielded change is not supported for multisig wallets. Pass changeShieldedMode: OutputKind.TRANSPARENT to keep the change transparent.')))
      .toBe('This wallet cannot receive the private change this transaction needs.');
  });

  test('takes no error for a locked one by its code alone', () => {
    const locked = Object.assign(new Error('locked'), { errorCode: 'shielded-locked' });
    expect(mapShieldedSendError(locked)).toBeNull();
    expect(mapTxError(locked)).toBe('locked');
  });

  test('keeps the input limit copy', () => {
    expect(mapTxError(new Error('The transaction needs 300 inputs, more than the 255 a transaction can hold.')))
      .toBe('This amount needs more inputs than a transaction can hold. Try sending a smaller amount.');
  });
});
