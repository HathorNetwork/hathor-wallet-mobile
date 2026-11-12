/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The HTTP calls to the Hathor Next backend (hathor-next's `hathor-wallet-backend`). The backend
 * talks to Hathor Next's wallet service and builds every transaction; the app only sends public
 * keys, signatures and intents. Nothing secret ever goes in a request.
 *
 * Amounts are decimal strings of base units and hex is lowercase, as the backend's contract says.
 */

/** How long a call may take, its whole answer included, before it is given up. */
export const REQUEST_TIMEOUT_MS = 15000;

/**
 * A failed call: `status` is the HTTP status (0 when the backend couldn't be reached), and the
 * message is the backend's own text.
 */
export class BackendError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   */
  constructor(status, message) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
  }

  /** Whether the session is missing or expired: log in again and retry. */
  get unauthorized() {
    return this.status === 401;
  }

  /** Whether the backend or the network failed, rather than the request. */
  get unreachable() {
    return this.status === 0 || this.status >= 502;
  }
}

/**
 * @param {string} baseUrl
 * @param {{ fetchImpl?: Function }} [options] Tests pass their own fetch
 */
export function createBackendApi(baseUrl, { fetchImpl = (...args) => fetch(...args) } = {}) {
  const root = baseUrl.replace(/\/+$/, '');

  async function request(method, path, { body, token } = {}) {
    const headers = { accept: 'application/json' };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
    let response;
    let text;
    // The timer covers the body too: an answer whose body stalls is given up like no answer.
    try {
      response = await fetchImpl(`${root}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller?.signal,
      });
      text = await response.text();
    } catch (e) {
      throw new BackendError(0, 'The Hathor Next backend could not be reached.');
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = null;
    }
    if (!response.ok) {
      throw new BackendError(response.status, data?.error ?? `HTTP ${response.status}`);
    }
    return data;
  }

  const wallet = (walletId) => `/v1/wallets/${encodeURIComponent(walletId)}`;

  return {
    baseUrl: root,

    /** @returns {Promise<Object>} The backend's pinned network values */
    getConfig: () => request('GET', '/v1/config'),

    /**
     * Registers the wallet's public keys. Idempotent.
     *
     * @param {Object} registration pub_b, auth_pub, read_pub, ts, sig_b, sig_auth, birthday
     */
    register: (registration) => request('POST', '/v1/wallets', { body: registration }),

    /**
     * Opens a session with a login the app signed.
     *
     * @param {string} walletId
     * @param {{ ts: number, scope: string, sig: string }} login
     */
    login: (walletId, login) => request('POST', `${wallet(walletId)}/session`, { body: login }),

    getBalance: (walletId, token) => request('GET', `${wallet(walletId)}/balance`, { token }),

    /**
     * @param {string} walletId
     * @param {string} token
     * @param {{ since?: string, limit?: number }} [page]
     */
    getHistory: (walletId, token, { since, limit } = {}) => {
      const query = new URLSearchParams();
      if (since) query.set('since', since);
      if (limit) query.set('limit', String(limit));
      const qs = query.toString();
      return request('GET', `${wallet(walletId)}/history${qs ? `?${qs}` : ''}`, { token });
    },

    getTokens: () => request('GET', '/v1/tokens'),

    /**
     * Asks the backend to build a payment. It answers with a sign request the app checks before
     * signing anything.
     *
     * @param {string} walletId
     * @param {string} token
     * @param {Object} send intent_id, to, amount, token (absent for the native token), max_fee
     */
    createSend: (walletId, token, send) => request('POST', `${wallet(walletId)}/sends`, {
      body: send,
      token,
    }),

    /**
     * @param {string} sendId
     * @param {string} token
     * @param {string[]} signatures One per input, in input order
     */
    signSend: (sendId, token, signatures) => request(
      'POST',
      `/v1/sends/${encodeURIComponent(sendId)}/signatures`,
      { body: { signatures }, token },
    ),

    getSend: (sendId, token) => request(
      'GET',
      `/v1/sends/${encodeURIComponent(sendId)}`,
      { token },
    ),

    /**
     * Submits again the exact bytes this app signed, for a backend that lost them.
     *
     * @param {string} sendId
     * @param {string} token
     * @param {string} signedTx
     */
    resubmitSend: (sendId, token, signedTx) => request(
      'POST',
      `/v1/sends/${encodeURIComponent(sendId)}/resubmit`,
      { body: { signed_tx: signedTx }, token },
    ),

    cancelSend: (sendId, token) => request(
      'DELETE',
      `/v1/sends/${encodeURIComponent(sendId)}`,
      { token },
    ),

    /**
     * Asks the backend to build a burn moving HTR to this wallet on Hathor Next. It answers with
     * the unsigned Hathor Network transaction the app checks and signs.
     *
     * @param {string} walletId
     * @param {string} token
     * @param {Object} transfer intent_id, amount, utxos [{ tx_id, index }], change_address,
     *   destination (a Hathor Next address; the wallet's own when absent)
     */
    createTransfer: (walletId, token, transfer) => request(
      'POST',
      `${wallet(walletId)}/transfers`,
      { body: transfer, token },
    ),

    /**
     * @param {string} transferId
     * @param {string} token
     * @param {string[]} inputData One per input: the P2PKH input data wallet-lib signed
     */
    signTransfer: (transferId, token, inputData) => request(
      'POST',
      `/v1/transfers/${encodeURIComponent(transferId)}/signatures`,
      { body: { input_data: inputData }, token },
    ),

    getTransfers: (walletId, token) => request('GET', `${wallet(walletId)}/transfers`, { token }),

    getTransfer: (transferId, token) => request(
      'GET',
      `/v1/transfers/${encodeURIComponent(transferId)}`,
      { token },
    ),

    /** Cancels a transfer no signature reached; 409 once one did. */
    cancelTransfer: (transferId, token) => request(
      'DELETE',
      `/v1/transfers/${encodeURIComponent(transferId)}`,
      { token },
    ),

    /**
     * The feed's WebSocket URL. The session goes in the query: React Native can't set headers on
     * a WebSocket reliably.
     *
     * @param {string} walletId
     * @param {string} token
     * @param {string|null} since
     * @returns {string}
     */
    feedUrl: (walletId, token, since) => {
      const query = new URLSearchParams({ token });
      if (since) query.set('since', since);
      return `${root.replace(/^http/, 'ws')}${wallet(walletId)}/feed?${query.toString()}`;
    },
  };
}
