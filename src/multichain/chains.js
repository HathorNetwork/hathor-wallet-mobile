/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
 * The side chains, by the network name the fullnode reports. A side chain is pinned here once its
 * network is deployed, with what the app needs to reach it:
 * - id and name: CHAIN.HATHOR_NEXT and its name;
 * - nativeTokenId, nativeTokenSymbol and nativeTokenName: Hathor Next's native token;
 * - explorerUrl and explorerApiBase: its explorer, or null;
 * - tokenMap: [{ hathor, next }], the tokens the bridge carries, by their id on each chain: each
 *   shows as one row, with its balance on both chains;
 * - directions: [{ from, to }], the ways the bridge transfers.
 * None is deployed yet, so no network has a side chain.
 */
const SIDE_CHAINS = {};

/**
 * The side chain of a network, or null when it has none. Pass the name the fullnode reports
 * (state.fullNodeNetworkName): a custom network pointed at a side chain's nodes has it too.
 *
 * @param {string|null|undefined} networkName
 * @returns {Object|null} The side chain config
 */
export function getSideChainConfig(networkName) {
  if (!networkName) {
    return null;
  }
  return SIDE_CHAINS[networkName] ?? null;
}
