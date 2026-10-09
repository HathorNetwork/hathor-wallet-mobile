/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { t } from 'ttag';
import { ErrorMessages, errors } from '@hathor/wallet-lib';

const {
  SHIELDED_LOCKED,
  SHIELDED_NOT_STARTED,
  SHIELDED_NO_PROVIDER,
} = ErrorMessages.ErrorMessages;

/**
 * Where the private (shielded) receive address of the running wallet stands.
 */
export const SHIELDED_RECEIVE_STATUS = {
  /** Nothing was read: the shielded UI is off for this wallet. */
  IDLE: 'idle',
  /** The wallet hasn't started, or hasn't loaded its shielded addresses yet. */
  LOADING: 'loading',
  /** The wallet gives out the address. */
  READY: 'ready',
  /** The wallet's scan key is locked: a PIN entry can unlock it. */
  LOCKED: 'locked',
  /** The wallet can't receive privately; the reason says why. */
  UNAVAILABLE: 'unavailable',
};

/**
 * The reason of a wallet that decodes its shielded outputs, but doesn't watch the addresses they
 * are paid to: its history sync doesn't poll.
 */
export const RECEIVE_REASON_NOT_WATCHED = 'not-watched';

/**
 * The reason of an error the receive state doesn't expect.
 */
export const RECEIVE_REASON_ERROR = 'error';

/**
 * The receive state before anything is read. It holds a receive address at most, never key
 * material.
 */
export const SHIELDED_RECEIVE_INITIAL_STATE = {
  /** One of SHIELDED_RECEIVE_STATUS. */
  status: SHIELDED_RECEIVE_STATUS.IDLE,
  /** @type {string|null} The current shielded address, when the status is ready. */
  address: null,
  /** @type {number|null} Its index on the shielded chain. */
  index: null,
  /**
   * @type {string|null} Why the status is locked or unavailable: the capability's lock cause or
   * reason, or the code of the error that refused the address.
   */
  reason: null,
};

/**
 * The lock cause of a stored scan key that no PIN can unlock.
 */
const CORRUPT_KEY_CAUSE = 'corrupt-key';

/**
 * The start of the message wallet-lib throws for a current shielded address while the shielded
 * addresses aren't loaded.
 */
const SHIELDED_ADDRESS_NOT_LOADED = /^Current shielded address is not loaded/;

/**
 * The receive state a shielded capability gives, or null when the wallet gives out its current
 * shielded address, which must then be read: at level 'view' or 'full', when it watches the
 * addresses shielded outputs are paid to.
 *
 * - 'none' before the wallet starts (reason 'not-started'): loading;
 * - 'none' for any other reason, such as 'no-provider': unavailable, with that reason;
 * - 'watch': locked, with the lock cause. The cause 'corrupt-key' is unavailable instead, as no
 *   PIN can unlock that key;
 * - 'view' or 'full' without canReceive: unavailable.
 *
 * @param {Object|null} capability The wallet's IShieldedCapability
 * @returns {{ status: string, reason: string|null }|null}
 */
export function receiveStateFromCapability(capability) {
  if (!capability) {
    return { status: SHIELDED_RECEIVE_STATUS.LOADING, reason: null };
  }
  const { level, reason, cause, canReceive } = capability;
  if (level === 'view' || level === 'full') {
    return canReceive
      ? null
      : { status: SHIELDED_RECEIVE_STATUS.UNAVAILABLE, reason: RECEIVE_REASON_NOT_WATCHED };
  }
  if (level === 'watch') {
    return cause === CORRUPT_KEY_CAUSE
      ? { status: SHIELDED_RECEIVE_STATUS.UNAVAILABLE, reason: cause }
      : { status: SHIELDED_RECEIVE_STATUS.LOCKED, reason: cause };
  }
  if (reason === 'not-started') {
    return { status: SHIELDED_RECEIVE_STATUS.LOADING, reason: null };
  }
  return { status: SHIELDED_RECEIVE_STATUS.UNAVAILABLE, reason };
}

/**
 * The receive state an error of wallet.getCurrentAddress({}, { legacy: false }) gives, or null
 * for an error it doesn't expect.
 *
 * - ShieldedKeyError 'shielded-locked': locked;
 * - ShieldedKeyError 'shielded-not-started', as when the wallet stops or starts again meanwhile:
 *   loading;
 * - any other ShieldedKeyError: unavailable, with its code;
 * - the plain Error 'Current shielded address is not loaded…', while the shielded addresses
 *   aren't loaded: loading.
 *
 * @param {unknown} error
 * @returns {{ status: string, reason: string|null }|null}
 */
export function receiveStateFromError(error) {
  if (error instanceof errors.ShieldedKeyError) {
    switch (error.errorCode) {
      case SHIELDED_LOCKED:
        return { status: SHIELDED_RECEIVE_STATUS.LOCKED, reason: null };
      case SHIELDED_NOT_STARTED:
        return { status: SHIELDED_RECEIVE_STATUS.LOADING, reason: null };
      default:
        return { status: SHIELDED_RECEIVE_STATUS.UNAVAILABLE, reason: error.errorCode };
    }
  }
  if (error instanceof Error && SHIELDED_ADDRESS_NOT_LOADED.test(error.message)) {
    return { status: SHIELDED_RECEIVE_STATUS.LOADING, reason: null };
  }
  return null;
}

/**
 * Why the wallet can't receive privately, for the user: either the device couldn't load private
 * transfers (the crypto provider failed), or this wallet can't use them.
 *
 * @param {string|null} reason The reason of an unavailable receive state
 * @returns {string}
 */
export function receiveReasonText(reason) {
  if (reason === 'no-provider' || reason === SHIELDED_NO_PROVIDER) {
    return t`Private transfers could not be loaded on this device.`;
  }
  return t`Private transfers are not available for this wallet.`;
}

/**
 * The private receive state of the running wallet.
 *
 * @param {Object} state Redux state
 * @returns {{ status: string, address: string|null, index: number|null, reason: string|null }}
 */
export function selectShieldedReceive(state) {
  return state.shielded?.receive ?? SHIELDED_RECEIVE_INITIAL_STATE;
}

/**
 * Whether two receive states hold the same status, address, index and reason.
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {boolean}
 */
export function isSameReceiveState(a, b) {
  return a.status === b.status
    && a.address === b.address
    && a.index === b.index
    && a.reason === b.reason;
}
