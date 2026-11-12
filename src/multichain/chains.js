/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FULL_NETWORK_MAINNET, NODE_SERVER_NEXT_DEVNET_URL } from '../constants';

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
 * The side chains, by the network name the fullnode reports. A side chain is pinned here once its
 * network is deployed, with what the app needs to reach it (the shape devBackendSideChain builds):
 * its backend, its network id, native token, service view key and wire format, the app's ceiling
 * on a payment's fee, its explorer or null, the tokens the bridge carries by their id on each
 * chain (each shows as one row, with its balance on both chains), the mint scale, the ways the
 * bridge transfers and the transfer's pinned values. A network whose node reports a name others
 * share is pinned by its node instead (SIDE_CHAINS_BY_NODE).
 */
const SIDE_CHAINS = {};

/** The most a payment may cost on a backend set up for local testing: 0.1 of the native token. */
const DEV_MAX_SEND_FEE = '10000000';

/**
 * Hathor Next through a backend set up for local testing (Settings → Hathor Next backend): its
 * pins are the backend's own GET /v1/config, read when the backend was set. Real side chains pin
 * their values in this file instead.
 *
 * A backend that transfers HTR mints it as its native token at the same value, so the two are
 * one token, HTR on both chains: one Dashboard row with both balances. A backend that transfers
 * nothing keeps its native token apart, under its own name.
 *
 * @param {{ url: string, pins: Object }} devBackend
 * @returns {Object}
 */
export function devBackendSideChain({ url, pins }) {
  const carriesHtr = Boolean(pins.transfer);
  return {
    id: CHAIN.HATHOR_NEXT,
    name: CHAIN_NAME[CHAIN.HATHOR_NEXT],
    client: 'backend',
    backendUrl: url,
    nextNetworkId: pins.next.network_id,
    nativeTokenId: pins.next.native_token,
    nativeTokenSymbol: carriesHtr ? 'HTR' : (pins.next.native_token_symbol ?? 'USDT'),
    nativeTokenName: carriesHtr ? 'Hathor' : (pins.next.native_token_name ?? 'Tether USD'),
    serviceViewPub: pins.next.service_view_pub,
    wireFormat: pins.next.wire_format,
    // The app's own ceiling on a payment's fee, in the native token's base units, whatever the
    // backend quotes.
    maxSendFee: DEV_MAX_SEND_FEE,
    explorerUrl: null,
    explorerApiBase: null,
    tokenMap: carriesHtr ? [{ hathor: '00', next: pins.next.native_token }] : [],
    // hathor-next mints a burn at the same value: 1.00 HTR becomes 1.00000000 of the native token.
    mintScale: '1000000',
    directions: pins.transfer ? [{ from: CHAIN.HATHOR, to: CHAIN.HATHOR_NEXT }] : [],
    transfer: pins.transfer ?? null,
  };
}

/**
 * The backend of devnet-alpha, hathor-next's deployed devnet, and its GET /v1/config as the app
 * pins it. The client refuses a backend whose network, native token, view key or wire format
 * differ from these, and the burn check pays only this transfer address: a devnet reset needs them
 * updated here.
 */
const DEVNET_ALPHA_BACKEND_URL = 'https://wallet-backend.devnet-alpha.samba.hathor.network';
const DEVNET_ALPHA_PINS = {
  contract: 1,
  hathor: { network: 'privatenet' },
  next: {
    network_id: 1003,
    native_token: 'e5bcdd06b7d2b896fe194e09b55d687737af3767407d9efc957ac0ea84f1e54c',
    service_view_pub: 'b292d1f347dd954a23814d66d60adc6848d89e97f09be952bb2f5f9025fe2e0e',
    wire_format: 'v3',
    native_token_symbol: 'nHTR',
    native_token_name: 'new HTR (devnet-alpha play money)',
  },
  transfer: {
    transfer_address: 'WScTqhLsBQnz3HMdQqh66JBgWqb255XffL',
    destination_network: '8822d70f304ab62d1198004dedeff39e2da86c259ca5669a2ad0b8c6bb641064',
    confirmations: 21,
    mean_block_ms: 5000,
    data_output_value: '1',
    hathor_network: 'privatenet',
  },
};

/**
 * Hathor Next on devnet-alpha, through its backend. A transfer mints HTR as its native token at
 * the same value, so the two show as one token, HTR on both chains.
 */
const DEVNET_ALPHA_HATHOR_NEXT = devBackendSideChain({
  url: DEVNET_ALPHA_BACKEND_URL,
  pins: DEVNET_ALPHA_PINS,
});

/**
 * The side chains of networks whose fullnode reports a name other networks share: every
 * privatenet reports 'privatenet'. By the node the wallet runs on (its network settings' nodeUrl).
 */
const SIDE_CHAINS_BY_NODE = [
  { nodeUrl: NODE_SERVER_NEXT_DEVNET_URL, config: DEVNET_ALPHA_HATHOR_NEXT },
];

function withoutTrailingSlashes(url) {
  return url.trim().replace(/\/+$/, '');
}

/**
 * The side chain pinned to a node, or null when none is: the node's URL tells the network apart.
 *
 * @param {string|null|undefined} nodeUrl The network settings' nodeUrl
 * @returns {Object|null}
 */
export function nodeSideChain(nodeUrl) {
  if (typeof nodeUrl !== 'string' || nodeUrl === '') {
    return null;
  }
  const url = withoutTrailingSlashes(nodeUrl);
  return SIDE_CHAINS_BY_NODE.find((entry) => withoutTrailingSlashes(entry.nodeUrl) === url)
    ?.config ?? null;
}

/**
 * The side chain of a network, or null when it has none. Pass the name the fullnode reports
 * (state.fullNodeNetworkName): a custom network pointed at a side chain's nodes has it too. Pass
 * the node too (the network settings' nodeUrl): a network whose name others share, such as
 * devnet-alpha's privatenet, is known by its node. A backend set up for local testing gives every
 * network but mainnet a side chain, in place of its own.
 *
 * @param {string|null|undefined} networkName
 * @param {{ url: string, pins: Object }|null} [devBackend] The backend for local testing in force
 * @param {string|null} [nodeUrl] The network settings' nodeUrl
 * @returns {Object|null} The side chain config
 */
// The last answer of getSideChainConfig: selectors read it on every store change, and a new
// object each time would render their screens again and rebuild the bridge.
const NOT_YET = Symbol('not yet');
let lastConfig = { networkName: NOT_YET, devBackend: null, nodeUrl: null, value: null };

export function getSideChainConfig(networkName, devBackend = null, nodeUrl = null) {
  if (lastConfig.networkName === networkName && lastConfig.devBackend === devBackend
    && lastConfig.nodeUrl === nodeUrl) {
    return lastConfig.value;
  }
  let value = null;
  if (networkName) {
    if (devBackend && networkName !== FULL_NETWORK_MAINNET) {
      value = devBackendSideChain(devBackend);
    } else {
      value = SIDE_CHAINS[networkName] ?? nodeSideChain(nodeUrl);
    }
  }
  lastConfig = { networkName, devBackend, nodeUrl, value };
  return value;
}
