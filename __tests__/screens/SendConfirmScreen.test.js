/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { mapTxError } from '../../src/screens/SendConfirmScreen';

describe('mapTxError', () => {
  const smallerAmount = 'This amount needs more inputs than a transaction can hold. Try sending a smaller amount.';

  // The messages wallet-lib throws when a send needs more inputs than a transaction can hold.
  // The first one tells the user to consolidate the wallet's UTXOs, which this app cannot do.
  test.each([
    "The transaction needs at least 301 inputs, more than the 255 a transaction can hold. Consolidate the wallet's UTXOs and try again.",
    'The transaction needs 300 inputs, more than the 255 a transaction can hold.',
    'Transaction has 301 inputs and can have at most 255.',
  ])('asks for a smaller amount for "%s"', (message) => {
    expect(mapTxError(new Error(message))).toBe(smallerAmount);
  });

  test('keeps the message of other errors', () => {
    expect(mapTxError(new Error('Transaction has 256 outputs and can have at most 255.')))
      .toBe('Transaction has 256 outputs and can have at most 255.');
  });
});
