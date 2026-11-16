/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { middleTruncate, nextRowTitle } from '../../src/components/Multichain/NextTxRow';

// Two addresses on one network: the wallet service's view key, and two spend keys that differ
// only in their middle.
const VIEW = 'ab'.repeat(32);
const SPEND_A = `${'11'.repeat(4)}${'cd'.repeat(24)}${'ef'.repeat(4)}`;
const SPEND_B = `${'22'.repeat(4)}${'cd'.repeat(24)}${'ef'.repeat(4)}`;
const A = `samba:${VIEW}${SPEND_A}`;
const B = `samba:${VIEW}${SPEND_B}`;

describe('a Hathor Next address, shortened', () => {
  test('keeps the start and the end of its spend key, not the view key every address shares', () => {
    expect(middleTruncate(A)).toBe('samba:…11111111…efefef');
    expect(middleTruncate(B)).toBe('samba:…22222222…efefef');
  });

  test('tells apart two addresses whose last characters are the same', () => {
    expect(middleTruncate(A)).not.toBe(middleTruncate(B));
    expect(nextRowTitle({ direction: 'out', peer: A })).not.toBe(
      nextRowTitle({ direction: 'out', peer: B }),
    );
  });

  test('keeps both ends of anything else', () => {
    expect(middleTruncate('WZ7pDnkPnxbs14GHdUFivFzPbzitwNtvZo')).toBe('WZ7pDnkPnx…wNtvZo');
    expect(middleTruncate('short')).toBe('short');
  });
});
