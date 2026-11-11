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
 * Which Hathor Next client the app runs where no backend is set up for local testing. Until a
 * Hathor Next test network is deployed, every side chain is simulated: nothing reaches a Hathor
 * Next network, and the transfer broadcasts nothing on Hathor Network either.
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
  // Hathor Next base units per HTR base unit in a transfer: hathor-next mints a burn at the same
  // value, so 1.00 HTR becomes 1.00000000.
  mintScale: '1000000',
  // The ways the bridge transfers. Hathor Next to Hathor Network is still to come.
  directions: [{ from: CHAIN.HATHOR, to: CHAIN.HATHOR_NEXT }],
};

/**
 * The transfer addresses of the chain transfer to Hathor Next (hathor-next's plan §3.3): what pays
 * them burns HTR on Hathor Network so it is minted on Hathor Next, and nothing ever spends from
 * them. Only the transfer itself may pay one; a send to one would lose its HTR.
 */
export const KNOWN_TRANSFER_ADDRESSES = [
  'WScTqhLsBQnz3HMdQqh66JBgWqb255XffL',
  'HT3Fm4qiQTx6XPe1sFDAPshgqSfck4nsqF',
];

/**
 * Whether an address is a transfer address: a known one, or the one the side chain pins.
 *
 * @param {string|null} address
 * @param {Object|null} config The side chain config
 * @returns {boolean}
 */
export function isTransferAddress(address, config) {
  const typed = address?.trim();
  if (!typed) {
    return false;
  }
  return KNOWN_TRANSFER_ADDRESSES.includes(typed)
    || typed === config?.transfer?.transfer_address;
}

/**
 * The symbol of what a transfer of Hathor Network's native token becomes on Hathor Next: the
 * same symbol where the bridge's token map carries the token, otherwise the side chain's native
 * token, which the burn mints at the chain's mint scale.
 *
 * @param {Object|null} config The side chain config
 * @param {string} hathorSymbol The symbol of Hathor Network's native token
 * @returns {string}
 */
export function transferReceiveSymbol(config, hathorSymbol) {
  if (!config || config.tokenMap?.some((m) => m.hathor === '00')) {
    return hathorSymbol;
  }
  return config.nativeTokenSymbol ?? hathorSymbol;
}

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

/** The most a payment may cost on a backend set up for local testing: 0.1 of the native token. */
const DEV_MAX_SEND_FEE = '10000000';

/**
 * Hathor Next through a backend set up for local testing (Settings → Hathor Next): its pins are
 * the backend's own GET /v1/config, read when the backend was set. Real side chains pin their
 * values in this file instead. Its tokens don't merge with Hathor Network's: nothing maps them yet.
 *
 * @param {{ url: string, pins: Object }} devBackend
 * @returns {Object}
 */
export function devBackendSideChain({ url, pins }) {
  return {
    id: CHAIN.HATHOR_NEXT,
    name: CHAIN_NAME[CHAIN.HATHOR_NEXT],
    client: 'backend',
    backendUrl: url,
    nextNetworkId: pins.next.network_id,
    nativeTokenId: pins.next.native_token,
    nativeTokenSymbol: pins.next.native_token_symbol ?? 'USDT',
    nativeTokenName: pins.next.native_token_name ?? 'Tether USD',
    serviceViewPub: pins.next.service_view_pub,
    wireFormat: pins.next.wire_format,
    // The app's own ceiling on a payment's fee, in the native token's base units, whatever the
    // backend quotes.
    maxSendFee: DEV_MAX_SEND_FEE,
    explorerUrl: null,
    explorerApiBase: null,
    tokenMap: [],
    // hathor-next mints a burn at the same value: 1.00 HTR becomes 1.00000000 of the native token.
    mintScale: '1000000',
    directions: pins.transfer ? [{ from: CHAIN.HATHOR, to: CHAIN.HATHOR_NEXT }] : [],
    transfer: pins.transfer ?? null,
  };
}

/**
 * The side chain of a network, or null when it has none. Pass the name the fullnode reports
 * (state.fullNodeNetworkName): a custom network pointed at Juliet's nodes has a side chain too.
 *
 * While the client is simulated, every network but mainnet has one, so the flows can be tried on
 * the testnets (whose nodes report names like `testnet-hotel`) before Juliet is deployed. A
 * backend set up for local testing takes the place of the simulated client on those networks.
 *
 * @param {string|null|undefined} networkName
 * @param {{ url: string, pins: Object }|null} [devBackend] state.multichain.devBackend
 * @returns {Object|null} The side chain config, with `simulated` set when the client is the mock
 */
// The last answer of getSideChainConfig: selectors read it on every store change, and a new
// object each time would render their screens again and rebuild the bridge.
const NOT_YET = Symbol('not yet');
let lastConfig = { networkName: NOT_YET, devBackend: null, simulated: null, value: null };

export function getSideChainConfig(networkName, devBackend = null) {
  const simulated = isSimulatedClient();
  if (lastConfig.networkName === networkName && lastConfig.devBackend === devBackend
    && lastConfig.simulated === simulated) {
    return lastConfig.value;
  }
  let value = null;
  if (networkName) {
    if (devBackend && networkName !== FULL_NETWORK_MAINNET) {
      value = { ...devBackendSideChain(devBackend), simulated: false };
    } else {
      const simulatedOnly = simulated && networkName !== FULL_NETWORK_MAINNET
        ? JULIET_HATHOR_NEXT
        : null;
      const config = SIDE_CHAINS[networkName] ?? simulatedOnly;
      value = config ? { ...config, simulated } : null;
    }
  }
  lastConfig = { networkName, devBackend, simulated, value };
  return value;
}
