/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { middleTruncate, nextRowTitle } from '../../src/components/Multichain/NextTxRow';
import { encodeAddress } from '../../src/multichain/next/kit/address';
import { publicKeyOf } from '../../src/multichain/next/kit/keys';
import { bytesToHex } from '../../src/multichain/next/kit/scalar';

// Two addresses on one network: the wallet service's view key, and two spend keys.
const VIEW = bytesToHex(publicKeyOf(7n));
const A = encodeAddress(VIEW, bytesToHex(publicKeyOf(11n)));
const B = encodeAddress(VIEW, bytesToHex(publicKeyOf(13n)));

describe('a Hathor Next address, shortened', () => {
  test('keeps the start of its spend key, not the view key every address shares', () => {
    // Shortened from the start, both would read the same: the view key is the network's.
    expect(A.slice(0, 40)).toBe(B.slice(0, 40));
    expect(middleTruncate(A)).toBe(`samba1…${A.slice(59, 67)}…${A.slice(-6)}`);
    expect(middleTruncate(A).slice(0, 15)).not.toBe(middleTruncate(B).slice(0, 15));
  });

  test('tells two addresses apart in the title of a payment\'s row', () => {
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
