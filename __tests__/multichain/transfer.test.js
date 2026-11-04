/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { CHAIN, getSideChainConfig, transferReceiveSymbol } from '../../src/multichain/chains';
import { shortBalanceAdvice } from '../../src/multichain/transfer';
import { nextToHathorRoundedUp } from '../../src/multichain/amount';
import { progressText } from '../../src/components/Multichain/TransferRow';
import { mockPeerAddress } from '../../src/multichain/mock/mockAddress';

const config = getSideChainConfig('testnet-juliet');
const NEXT_ADDRESS = mockPeerAddress('ab12');
const OWN_ADDRESS = mockPeerAddress('cd34');
// The mock bridge's quote: 0.10 HTR bridge fee, no network fee, in Hathor Network's units.
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
    expect(nextToHathorRoundedUp(3000000000n, 1000000n)).toBe(3000n);
    expect(nextToHathorRoundedUp(3000000001n, 1000000n)).toBe(3001n);
    expect(nextToHathorRoundedUp(700n, 1n)).toBe(700n);
  });
});

describe('a transfer\'s progress, as its bridge follows it', () => {
  test('counts the burn\'s confirmations, then says it is minting', () => {
    expect(progressText({ stage: 'confirming', confirmations: 5, needed: 21 }))
      .toBe('Confirming 5 of 21 on Hathor Network');
    expect(progressText({ stage: 'eligible', confirmations: 21, needed: 21 }))
      .toBe('Minting on Hathor Next');
    expect(progressText(undefined)).toBeNull();
    expect(progressText({ stage: 'arrived' })).toBeNull();
  });
});

describe("what a transfer of Hathor Network's native token becomes on Hathor Next", () => {
  test('the same token where the bridge carries it, the native token where it mints that', () => {
    expect(transferReceiveSymbol(getSideChainConfig('testnet-juliet'), 'TNT')).toBe('TNT');
    expect(transferReceiveSymbol({ tokenMap: [], nativeTokenSymbol: 'USDT' }, 'TNT')).toBe('USDT');
  });
});
