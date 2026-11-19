/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest } from '@jest/globals';

// The real chains module: tests replace it with chainsModule.js, which reads this file.
const { CHAIN, CHAIN_NAME } = jest.requireActual('../../../src/multichain/chains');

/**
 * The network the tests run on: the name its fullnode reports. The app has no side chain of its
 * own on it; the tests give it FAKE_SIDE_CHAIN (see chainsModule.js).
 */
export const FAKE_NETWORK = 'testnet-next';

/**
 * The side chain of FAKE_NETWORK, for the fake client and bridge. Its native token is HTR: a
 * transfer turns the network's HTR into Hathor Next's HTR.
 */
export const FAKE_SIDE_CHAIN = {
  id: CHAIN.HATHOR_NEXT,
  name: CHAIN_NAME[CHAIN.HATHOR_NEXT],
  nativeTokenId: '00',
  nativeTokenSymbol: 'HTR',
  nativeTokenName: 'Hathor',
  explorerUrl: 'https://explorer.next.test/',
  explorerApiBase: 'https://explorer-api.next.test/',
  // The tokens the bridge carries, by their id on each chain. Only HTR, which becomes Hathor
  // Next's native token.
  tokenMap: [{ hathor: '00', next: '00' }],
  // Hathor Next base units per HTR base unit in a transfer: 1.00 HTR becomes 1.00000000.
  mintScale: '1000000',
  directions: [{ from: CHAIN.HATHOR, to: CHAIN.HATHOR_NEXT }],
};
