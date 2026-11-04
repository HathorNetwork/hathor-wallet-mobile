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
  // The backend built a payment other than the one approved: nothing was signed.
  REFUSED: 'refused',
  PREPARE_FAILED: 'prepare-failed',
  // An earlier payment signed the same outputs and hasn't settled: it was submitted again.
  EARLIER_PENDING: 'earlier-pending',
  // A transfer can only go to the wallet's own Hathor Next address.
  TRANSFER_OWN_ONLY: 'transfer-own-only',
  // The backend built a burn other than the one approved: nothing was signed.
  TRANSFER_REFUSED: 'transfer-refused',
  // Signed, but whether the burn reached the network is not known yet.
  TRANSFER_UNCERTAIN: 'transfer-uncertain',
  // Signed, and it never reached the network: nothing left the wallet.
  TRANSFER_NOT_SENT: 'transfer-not-sent',
  // The amount needs more outputs than one transaction holds.
  TRANSFER_TOO_MANY_INPUTS: 'transfer-too-many-inputs',
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
    case NEXT_CLIENT_ERROR.REFUSED:
      return t`Hathor Next prepared a different payment than the one you approved, so nothing was signed or sent.`;
    case NEXT_CLIENT_ERROR.PREPARE_FAILED:
      return t`Hathor Next couldn't prepare this payment. Nothing was sent.`;
    case NEXT_CLIENT_ERROR.EARLIER_PENDING:
      return t`An earlier payment from these funds hasn't settled yet, so it was sent again. Try this payment once it settles.`;
    case NEXT_CLIENT_ERROR.TRANSFER_OWN_ONLY:
      return t`Transfers to Hathor Next go to your own Hathor Next address.`;
    case NEXT_CLIENT_ERROR.TRANSFER_REFUSED:
      return t`Hathor Next prepared a different transfer than the one you approved, so nothing was signed or sent.`;
    case NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN:
      return t`We couldn't confirm the transfer yet. Check your Hathor Network history before trying again.`;
    case NEXT_CLIENT_ERROR.TRANSFER_NOT_SENT:
      return t`The transfer didn't go through. Nothing left your wallet.`;
    case NEXT_CLIENT_ERROR.TRANSFER_TOO_MANY_INPUTS:
      return t`This amount needs too many of your Hathor Network outputs for one transfer. Try a smaller amount.`;
    default:
      return t`Something went wrong on Hathor Next.`;
  }
}

export class NextClientError extends Error {
  /**
   * @param {string} code One of NEXT_CLIENT_ERROR
   * @param {Object} [details] What the caller needs to recover, e.g. a transfer's id
   */
  constructor(code, details = {}) {
    super(nextClientErrorMessage(code));
    this.name = 'NextClientError';
    this.code = code;
    Object.assign(this, details);
  }
}
