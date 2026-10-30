/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FULL_NETWORK_JULIET_TESTNET, FULL_NETWORK_MAINNET } from '../constants';

/**
 * The chains a wallet can use on a network with a side chain: the network's own chain, and its
 * side chain.
 */
export const CHAIN = {
  HATHOR: 'hathor',
  HATHOR_NEXT: 'hathor-next',
};

/**
 * Chain names are brand names: they are never translated.
 */
export const CHAIN_NAME = {
  [CHAIN.HATHOR]: 'Hathor Network',
  [CHAIN.HATHOR_NEXT]: 'Hathor Next',
};

/**
 * The colors of Hathor Next, from the Hathor Next wallet's default theme (Bateria, in
 * hathor-next-wallet-mobile's src/theme/tokens.ts). The accent is too light for text on this app's
 * white background, so text in the Hathor Next color uses accentText, a darker shade of the same
 * hue that reaches 5:1 on white.
 */
export const NEXT_COLORS = {
  accent: '#FF6B5A',
  accentText: '#C73E2E',
  accentSoft: '#FFEDEA',
  ink: '#6F6579',
};

/**
 * Every Hathor Next amount has 8 decimal places.
 */
export const NEXT_DECIMAL_PLACES = 8;

/**
 * Which Hathor Next client the app runs. Until the lib team ships the real one, every side chain
 * is simulated: nothing reaches a Hathor Next network, and the transfer broadcasts nothing on
 * Hathor Network either.
 */
export const MULTICHAIN_CLIENT_KIND = 'mock';

/**
 * Whether the app runs the simulated Hathor Next client.
 *
 * @returns {boolean}
 */
export function isSimulatedClient() {
  return MULTICHAIN_CLIENT_KIND === 'mock';
}

/**
 * Hathor Next on testnet Juliet. The native token is HTR: a transfer from Juliet turns its HTR
 * into Hathor Next's HTR. The service and explorer URLs follow Juliet's naming until Hathor Next
 * is deployed there.
 */
const JULIET_HATHOR_NEXT = {
  id: CHAIN.HATHOR_NEXT,
  name: CHAIN_NAME[CHAIN.HATHOR_NEXT],
  serviceUrl: 'https://wallet-service.next.juliet.testnet.hathor.network',
  nativeTokenId: '00',
  nativeTokenSymbol: 'HTR',
  nativeTokenName: 'Hathor',
  explorerUrl: 'https://explorer.next.juliet.testnet.hathor.network/',
  explorerApiBase: 'https://explorer-api.next.juliet.testnet.hathor.network/',
  // The tokens the bridge carries, by their id on each chain: each shows as one row, with its
  // balance on both chains. Only HTR so far, which becomes Hathor Next's native token.
  tokenMap: [{ hathor: '00', next: '00' }],
  // The ways the bridge transfers. Hathor Next to Hathor Network is still to come.
  directions: [{ from: CHAIN.HATHOR, to: CHAIN.HATHOR_NEXT }],
};

/**
 * Whether the bridge of a side chain transfers from one chain to the other.
 *
 * @param {Object|null} config The side chain config
 * @param {string} from One of CHAIN
 * @param {string} to One of CHAIN
 * @returns {boolean}
 */
export function canTransfer(config, from, to) {
  return Boolean(config?.directions?.some((way) => way.from === from && way.to === to));
}

/**
 * The other chain of the two.
 *
 * @param {string} chain One of CHAIN
 * @returns {string}
 */
export function otherChain(chain) {
  return chain === CHAIN.HATHOR ? CHAIN.HATHOR_NEXT : CHAIN.HATHOR;
}

/**
 * The side chains, by the network name the fullnode reports.
 */
const SIDE_CHAINS = {
  [FULL_NETWORK_JULIET_TESTNET]: JULIET_HATHOR_NEXT,
};

/**
 * The side chain of a network, or null when it has none. Pass the name the fullnode reports
 * (state.fullNodeNetworkName): a custom network pointed at Juliet's nodes has a side chain too.
 *
 * While the client is simulated, every network but mainnet has one, so the flows can be tried on
 * the testnets (whose nodes report names like `testnet-hotel`) before Juliet is deployed.
 *
 * @param {string|null|undefined} networkName
 * @returns {Object|null} The side chain config, with `simulated` set when the client is the mock
 */
export function getSideChainConfig(networkName) {
  if (!networkName) {
    return null;
  }
  const simulated = isSimulatedClient();
  const simulatedOnly = simulated && networkName !== FULL_NETWORK_MAINNET
    ? JULIET_HATHOR_NEXT
    : null;
  const config = SIDE_CHAINS[networkName] ?? simulatedOnly;
  if (!config) {
    return null;
  }
  return { ...config, simulated };
}
