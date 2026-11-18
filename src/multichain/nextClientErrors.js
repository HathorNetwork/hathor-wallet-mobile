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
  // Public funds alone would pay the one hidden output of a token, whose amount would then be
  // readable on chain: the wallet service refuses to prepare it.
  AMOUNT_VISIBLE: 'amount-visible',
  // A payment in another token whose fee only public native funds can pay: the fee's change, the
  // one hidden native output, would show its amount. Sending less of the token doesn't help.
  FEE_AMOUNT_VISIBLE: 'fee-amount-visible',
  // An earlier payment signed the same outputs and hasn't settled: it was submitted again.
  EARLIER_PENDING: 'earlier-pending',
  // The transfer's destination is not a Hathor Next address.
  TRANSFER_BAD_ADDRESS: 'transfer-bad-address',
  // The backend built a burn other than the one approved: nothing was signed.
  TRANSFER_REFUSED: 'transfer-refused',
  // Signed, but whether the burn reached the network is not known yet.
  TRANSFER_UNCERTAIN: 'transfer-uncertain',
  // Signed, and it never reached the network: nothing left the wallet.
  TRANSFER_NOT_SENT: 'transfer-not-sent',
  // Signed, and the backend no longer knows it: nobody can say more of it.
  TRANSFER_FORGOTTEN: 'transfer-forgotten',
  // The amount needs more outputs than one transaction holds.
  TRANSFER_TOO_MANY_INPUTS: 'transfer-too-many-inputs',
  // The backend doesn't create tokens, or its wallet service can't settle a creation.
  TOKENS_UNAVAILABLE: 'tokens-unavailable',
  // The backend couldn't prepare the creation: nothing was created.
  TOKEN_PREPARE_FAILED: 'token-prepare-failed',
  // The backend built another token than the one approved: nothing was signed.
  TOKEN_REFUSED: 'token-refused',
  // The token registry couldn't be read, so no nonce can be proven free for the token's keys.
  TOKEN_AUTHORITIES_UNKNOWN: 'token-authorities-unknown',
  // Too many creations started and didn't finish: a new token couldn't be found again from the
  // words.
  TOKEN_NONCE_BEYOND_REACH: 'token-nonce-beyond-reach',
  // The backend is on another Hathor Next network than the one this app pins: the network was
  // reset or replaced, and the app needs an update.
  NETWORK_CHANGED: 'network-changed',
  // The wallet service refused the login for its time: the phone's clock is off.
  CLOCK: 'clock',
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
    case NEXT_CLIENT_ERROR.AMOUNT_VISIBLE:
      return t`Sending all of these funds would make the amount public on Hathor Next. Send a little less, so some comes back to you as change.`;
    case NEXT_CLIENT_ERROR.FEE_AMOUNT_VISIBLE:
      return t`The network fee would come from HTR whose amount is already public, so the HTR you'd get back would be public on Hathor Next too. Send some HTR to your own Hathor Next address first, then try again.`;
    case NEXT_CLIENT_ERROR.EARLIER_PENDING:
      return t`An earlier payment from these funds hasn't settled yet, so it was sent again. Try this payment once it settles.`;
    case NEXT_CLIENT_ERROR.TRANSFER_BAD_ADDRESS:
      return t`Invalid address`;
    case NEXT_CLIENT_ERROR.TRANSFER_REFUSED:
      return t`Hathor Next prepared a different transfer than the one you approved, so nothing was signed or sent.`;
    case NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN:
      return t`We couldn't confirm the transfer yet. Check your Hathor Network history before trying again.`;
    case NEXT_CLIENT_ERROR.TRANSFER_NOT_SENT:
      return t`The transfer didn't go through. Nothing left your wallet.`;
    case NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN:
      return t`Hathor Next no longer knows this transfer. Check your Hathor Network history before you transfer again.`;
    case NEXT_CLIENT_ERROR.TRANSFER_TOO_MANY_INPUTS:
      return t`This amount needs too many of your Hathor Network outputs for one transfer. Try a smaller amount.`;
    case NEXT_CLIENT_ERROR.TOKENS_UNAVAILABLE:
      return t`Tokens can't be created on this Hathor Next network yet.`;
    case NEXT_CLIENT_ERROR.TOKEN_PREPARE_FAILED:
      return t`Hathor Next couldn't prepare this token. Nothing was created.`;
    case NEXT_CLIENT_ERROR.TOKEN_REFUSED:
      return t`Hathor Next prepared a different token than the one you approved, so nothing was signed or created.`;
    case NEXT_CLIENT_ERROR.TOKEN_AUTHORITIES_UNKNOWN:
      return t`Hathor Next's list of tokens couldn't be read, so this wallet can't safely pick the keys for a new token. Nothing was created. Try again later.`;
    case NEXT_CLIENT_ERROR.TOKEN_NONCE_BEYOND_REACH:
      return t`Too many token creations were started without finishing. A new token couldn't be found again from your recovery words, so none was created.`;
    case NEXT_CLIENT_ERROR.NETWORK_CHANGED:
      return t`Hathor Next's network changed, and this version of the app can't connect to it. Update the app, or disconnect the side chain for now.`;
    case NEXT_CLIENT_ERROR.CLOCK:
      return t`Couldn't sign in to Hathor Next: your phone's date and time are off. Set them to update automatically, then try again.`;
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

/**
 * The words a failure is shown with: the client's own, translated, for one of its errors; for
 * anything else (a bug, a network library's message, a server's words) the fallback, so the user
 * never reads an untranslated exception.
 *
 * @param {Error} e
 * @param {Function} [fallback] The words for any other failure
 * @returns {string}
 */
export function userErrorText(e, fallback = () => nextClientErrorMessage()) {
  return e instanceof NextClientError ? e.message : fallback();
}
