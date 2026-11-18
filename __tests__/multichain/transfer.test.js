/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { CHAIN } from '../../src/multichain/chains';
import { nextToHathorRoundedUp, shortBalanceAdvice } from '../../src/multichain/transfer';
import { FAKE_SIDE_CHAIN } from './fakes/sideChain';

const config = FAKE_SIDE_CHAIN;
const NEXT_ADDRESS = `samba:${'ab12'.repeat(32)}`;
const OWN_ADDRESS = `samba:${'cd34'.repeat(32)}`;
// The fake bridge's quote: 0.10 HTR bridge fee, no network fee, in Hathor Network's units.
const quote = { bridgeFee: 10n, networkFee: 0n, etaSeconds: 120 };

const onNext = (fields) => shortBalanceAdvice({
  chain: CHAIN.HATHOR_NEXT,
  // 30.00 HTR plus Hathor Next's 0.05 fee
  amount: 3000000000n,
  fee: 5000000n,
  config,
  quote,
  symbol: 'HTR',
  hathorDecimalPlaces: 2,
  toAddress: NEXT_ADDRESS,
  ownAddress: OWN_ADDRESS,
  ...fields,
});

describe('a send short on Hathor Next', () => {
  test('offers to send it all from Hathor Network, straight to the address', () => {
    const advice = onNext({ available: 300000000n, otherAvailable: 100000n });
    expect(advice.message).toBe('You have 3.00 HTR on Hathor Next. Send from Hathor Network instead? It arrives in about 2 minutes.');
    // 30.00 to arrive, plus the bridge fee; Hathor Next's own fee isn't paid on this path.
    expect(advice.transfer).toEqual({ amount: 3010n, toAddress: NEXT_ADDRESS });
  });

  test('offers the shortfall to its own address when only both chains together have it', () => {
    const advice = onNext({ available: 2000000000n, otherAvailable: 1500n });
    expect(advice.message).toBe('You have 20.00 HTR on Hathor Next and 15.00 HTR on Hathor Network. Transfer the rest to Hathor Next first.');
    // 30.05 - 20.00 = 10.05, plus the bridge fee
    expect(advice.transfer).toEqual({ amount: 1015n, toAddress: OWN_ADDRESS });
  });

  test('says nothing more when neither chain has it', () => {
    expect(onNext({ available: 100000000n, otherAvailable: 500n })).toBeNull();
  });
});

describe('a send short on Hathor Network', () => {
  test("says the transfer from Hathor Next isn't there yet", () => {
    const advice = shortBalanceAdvice({
      chain: CHAIN.HATHOR,
      amount: 3000n,
      fee: 0n,
      available: 200n,
      otherAvailable: 3000000000n,
      config,
      quote: null,
      symbol: 'HTR',
      hathorDecimalPlaces: 2,
      toAddress: 'W...',
      ownAddress: null,
    });
    expect(advice).toEqual({
      message: "You have 2.00 HTR on Hathor Network. Transfers from Hathor Next to Hathor Network aren't available yet.",
      transfer: null,
    });
  });
});

describe('amounts across chains', () => {
  test('round up what has to leave Hathor Network for an amount to arrive', () => {
    expect(nextToHathorRoundedUp(3000000000n, 2)).toBe(3000n);
    expect(nextToHathorRoundedUp(3000000001n, 2)).toBe(3001n);
  });
});
