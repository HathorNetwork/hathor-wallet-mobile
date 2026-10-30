/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isSimulatedClient } from './chains';
import { createMockNextClient } from './mock/mockNextClient';
import { NextClientError, NEXT_CLIENT_ERROR } from './nextClientErrors';

/**
 * The Hathor Next client: the one object that talks to Hathor Next. The real one is built on the
 * Hathor Next wallet's shell (@samba/wallet-shell) by the lib team; until then every side chain is
 * simulated (see MULTICHAIN_CLIENT_KIND), and the simulated client has the same interface:
 *
 * - prepareKeys({ words }) → { address }: derives the keys from the seed; no network. They stay
 *   in memory only, and are the same on every network.
 * - hasKeys() → boolean
 * - connect({ network, config, birthday: 'genesis' }): registers the wallet on the network's
 *   Hathor Next on first use, from the beginning of the chain (a later birthday loses funds for
 *   good), and opens the session.
 * - disconnect(): closes the session; the keys stay. A connect still running fails.
 * - getAddress() → string: the one address, reusable forever.
 * - getNetwork() → string|null: the network connected to.
 * - isOnline() → boolean
 * - getTokens() → [{ id, name, symbol, lastActivityAt }]: lastActivityAt is null for a token
 *   that never moved.
 * - getBalances() → { sweeping, balances: { [tokenId]: { available: bigint } } }
 * - getHistory(tokenId, { cursor }) → { rows, cursor }: rows newest first.
 * - getSendFee() → bigint: the flat fee, in the native token.
 * - send({ tokenId, to, amount }) → { sendId }: sign-once; the outcome arrives as a SEND event.
 * - on(event, listener) → unsubscribe: events are NEXT_CLIENT_EVENT.
 *
 * One client lives for the app's session: its keys survive reconnects and network changes.
 *
 * @returns {Object}
 */
export function createNextClient() {
  if (isSimulatedClient()) {
    return createMockNextClient();
  }
  throw new NextClientError(NEXT_CLIENT_ERROR.UNAVAILABLE);
}

/**
 * The running client. It lives outside Redux, like the bridge to it: it holds keys and timers,
 * and screens only read what the saga puts in state.multichain.
 */
let currentClient = null;

/** @returns {Object|null} */
export function getNextClient() {
  return currentClient;
}

/**
 * The running client, created on first use.
 *
 * @returns {Object}
 */
export function ensureNextClient() {
  if (!currentClient) {
    currentClient = createNextClient();
  }
  return currentClient;
}

/** @param {Object|null} client */
export function setNextClient(client) {
  currentClient = client;
}
