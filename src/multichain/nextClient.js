/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createMockNextClient } from './mock/mockNextClient';
import { createBackendNextClient } from './next/backendClient';

/**
 * The kinds of Hathor Next client: the simulated one, and the one backed by the Hathor Next
 * backend, which reads Hathor Next and builds transactions while the client keeps the keys and
 * signs.
 */
export const NEXT_CLIENT_KIND = {
  MOCK: 'mock',
  BACKEND: 'backend',
};

/**
 * The Hathor Next client: the one object that talks to Hathor Next. Both kinds have the same
 * interface:
 *
 * - prepareKeys({ words }) → Promise<{ address } | { pubB }>: derives the keys from the seed; no
 *   network. They stay in memory only, and are the same on every network. The backend client
 *   knows its address only once connected: the address carries the network's view key.
 * - hasKeys() → boolean
 * - forgetKeys() → boolean: drops the keys when the app locks; whether it dropped any
 * - connect({ network, config, birthday: 'genesis' }): registers the wallet on the network's
 *   Hathor Next on first use, from the beginning of the chain (a later birthday loses funds for
 *   good), and opens the session.
 * - disconnect(): closes the session; the keys stay. A connect still running fails.
 * - getAddress() → string|null: the one address, reusable forever.
 * - getNetwork() → string|null: the network connected to.
 * - isOnline() → boolean
 * - getTokens() → [{ id, name, symbol, lastActivityAt }]: lastActivityAt is null for a token
 *   that never moved.
 * - getBalances() → { sweeping, balances: { [tokenId]: { available: bigint } } }
 * - getHistory(tokenId, { cursor }) → { rows, cursor }: rows newest first.
 * - getSendFee() → bigint: the flat fee, in the native token.
 * - send({ tokenId, to, amount }) → { sendId }: sign-once; the outcome arrives as a SEND event.
 * - getSend(sendId) → { sendId, status, reason, txId } | null: a payment's state now, for an
 *   outcome that came before send() returned.
 * - on(event, listener) → unsubscribe: events are NEXT_CLIENT_EVENT.
 *
 * One client lives for the app's session: its keys survive reconnects and network changes.
 *
 * @param {string} kind One of NEXT_CLIENT_KIND
 * @returns {Object}
 */
export function createNextClient(kind) {
  return kind === NEXT_CLIENT_KIND.BACKEND ? createBackendNextClient() : createMockNextClient();
}

/**
 * The running client. It lives outside Redux, like the bridge to it: it holds keys and timers,
 * and screens only read what the saga puts in state.multichain.
 */
let currentClient = null;
let currentKind = NEXT_CLIENT_KIND.MOCK;

/**
 * Sets the kind of client the app runs. A change drops the running client and its keys: the next
 * one derives its own at the next unlock or load.
 *
 * @param {string} kind One of NEXT_CLIENT_KIND
 * @returns {boolean} Whether the kind changed
 */
export function setNextClientKind(kind) {
  if (kind === currentKind) {
    return false;
  }
  currentClient?.disconnect();
  currentClient = null;
  currentKind = kind;
  return true;
}

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
    currentClient = createNextClient(currentKind);
  }
  return currentClient;
}

/** @param {Object|null} client */
export function setNextClient(client) {
  currentClient = client;
}
