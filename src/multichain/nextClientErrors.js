/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { t } from 'ttag';

/**
 * The events a Hathor Next client emits:
 * - BALANCE / HISTORY: the balances or the rows changed, read them again;
 * - CONNECTION: { online }, the connection dropped or came back;
 * - SWEEP: { sweeping }, the first sync started or ended;
 * - SEND: { sendId, status, reason, txId }, a payment's outcome.
 */
export const NEXT_CLIENT_EVENT = {
  BALANCE: 'balance',
  HISTORY: 'history',
  CONNECTION: 'connection',
  SWEEP: 'sweep',
  SEND: 'send',
};

export const NEXT_CLIENT_ERROR = {
  NO_KEYS: 'no-keys',
  NOT_CONNECTED: 'not-connected',
  CONNECT_FAILED: 'connect-failed',
  OFFLINE: 'offline',
  SWEEPING: 'sweeping',
  INSUFFICIENT_FUNDS: 'insufficient-funds',
  UNAVAILABLE: 'unavailable',
};

/**
 * What the user is told about a client error.
 *
 * @param {string} code One of NEXT_CLIENT_ERROR
 * @returns {string}
 */
export function nextClientErrorMessage(code) {
  switch (code) {
    case NEXT_CLIENT_ERROR.OFFLINE:
      return t`No internet connection`;
    case NEXT_CLIENT_ERROR.SWEEPING:
      return t`You can send once your balance finishes syncing.`;
    case NEXT_CLIENT_ERROR.INSUFFICIENT_FUNDS:
      return t`Insufficient funds`;
    case NEXT_CLIENT_ERROR.CONNECT_FAILED:
    case NEXT_CLIENT_ERROR.UNAVAILABLE:
      return t`Couldn't connect to Hathor Next.`;
    default:
      return t`Something went wrong on Hathor Next.`;
  }
}

export class NextClientError extends Error {
  /**
   * @param {string} code One of NEXT_CLIENT_ERROR
   */
  constructor(code) {
    super(nextClientErrorMessage(code));
    this.name = 'NextClientError';
    this.code = code;
  }
}
