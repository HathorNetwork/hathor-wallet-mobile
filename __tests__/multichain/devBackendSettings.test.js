/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { isUsableBackendConfig } from '../../src/components/Multichain/DevBackendSettings';
import { CHAIN, devBackendSideChain, transferReceiveSymbol } from '../../src/multichain/chains';
import { combinedTokenList } from '../../src/multichain/tokens';
import { hathorToNextAmount, mintScaleOf } from '../../src/multichain/amount';

const pinsOf = (next) => ({
  next: {
    network_id: 1777,
    native_token: 'aa'.repeat(32),
    service_view_pub: 'bb'.repeat(32),
    wire_format: 'v2',
    genesis_ms: 1793398418273,
    epoch_ms: 500,
    ...next,
  },
});

describe('a backend for local testing', () => {
  test('runs on a network of either format the signer reads', () => {
    expect(isUsableBackendConfig(pinsOf({ wire_format: 'v2' }))).toBe(true);
    expect(isUsableBackendConfig(pinsOf({ wire_format: 'v3' }))).toBe(true);
  });

  test('is refused on any other format, or with a pin missing', () => {
    expect(isUsableBackendConfig(pinsOf({ wire_format: 'v1' }))).toBe(false);
    expect(isUsableBackendConfig(pinsOf({ wire_format: undefined }))).toBe(false);
    expect(isUsableBackendConfig(pinsOf({ native_token: 'aa' }))).toBe(false);
    expect(isUsableBackendConfig({})).toBe(false);
  });

  test('shows a transfer arriving at the same value: 1.00 HTR becomes 1.00000000', () => {
    const config = devBackendSideChain({ url: 'http://backend.test', pins: pinsOf({ wire_format: 'v3' }) });
    expect(hathorToNextAmount(100n, mintScaleOf(config)).toString()).toBe('100000000');
  });

  // What devnet-alpha's backend serves: its native token is HTR's counterpart, at the same value.
  const transferring = (next) => ({
    ...pinsOf({ native_token_symbol: 'nHTR', native_token_name: 'new HTR', ...next }),
    transfer: {
      transfer_address: 'WScTqhLsBQnz3HMdQqh66JBgWqb255XffL',
      destination_network: 'cc'.repeat(32),
      confirmations: 21,
      mean_block_ms: 5000,
    },
  });

  test('carries HTR to its native token where it transfers HTR: one token', () => {
    const config = devBackendSideChain({ url: 'http://backend.test', pins: transferring() });
    expect(config.tokenMap).toEqual([{ hathor: '00', next: 'aa'.repeat(32) }]);
    expect(config).toMatchObject({ nativeTokenSymbol: 'HTR', nativeTokenName: 'Hathor' });
    expect(transferReceiveSymbol(config, 'HTR')).toBe('HTR');
  });

  test('shows HTR on both chains as one Dashboard row, with both balances', () => {
    const config = devBackendSideChain({ url: 'http://backend.test', pins: transferring() });
    const native = config.nativeTokenId;
    const rows = combinedTokenList({
      hathorTokens: { '00': { uid: '00', name: 'Hathor', symbol: 'HTR' } },
      hathorBalances: { '00': { status: 'ready', data: { available: 1499n } } },
      hathorDecimalPlaces: 2,
      nextTokens: { [native]: { uid: native, name: 'Hathor', symbol: 'HTR' } },
      nextBalances: { [native]: { data: { available: 395000000n } } },
      tokenMap: config.tokenMap,
      nativeTokenId: native,
      transfers: [],
      mintScale: mintScaleOf(config),
    });
    // 14.99 HTR on Hathor Network and 3.95 on Hathor Next.
    expect(rows).toEqual([expect.objectContaining({
      uid: '00',
      symbol: 'HTR',
      chains: [CHAIN.HATHOR, CHAIN.HATHOR_NEXT],
      available: 1894n,
      decimalPlaces: 2,
    })]);
  });

  test('carries nothing where it transfers nothing, and keeps its own native token', () => {
    const config = devBackendSideChain({
      url: 'http://backend.test',
      pins: pinsOf({ native_token_symbol: 'USDT', native_token_name: 'Tether USD' }),
    });
    expect(config.tokenMap).toEqual([]);
    expect(config).toMatchObject({ nativeTokenSymbol: 'USDT', nativeTokenName: 'Tether USD' });
    expect(transferReceiveSymbol(config, 'HTR')).toBe('USDT');
  });
});
