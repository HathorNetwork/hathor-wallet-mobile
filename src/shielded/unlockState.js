/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Where the unlock of a locked private balance, or the retry of private funds that couldn't be
 * read, stands. Only what the user asks for reports progress: the unlock at the lock screen
 * shows nothing.
 */
export const SHIELDED_UNLOCK_PROGRESS = {
  /** Nothing runs. */
  IDLE: 'idle',
  /** The PIN is unlocking the wallet's scan key. */
  UNLOCKING: 'unlocking',
  /** The wallet processes its history to decode its private outputs, then the balances reload. */
  DECODING: 'decoding',
  /** wallet-lib refused the unlock, or it failed; errorCode says why when wallet-lib refused. */
  FAILED: 'failed',
};

/**
 * The progress before anything runs. It never holds the PIN.
 */
export const SHIELDED_UNLOCK_INITIAL_STATE = {
  /** One of SHIELDED_UNLOCK_PROGRESS. */
  status: SHIELDED_UNLOCK_PROGRESS.IDLE,
  /** @type {string|null} The code of wallet-lib's ShieldedKeyError, when it refused the unlock. */
  errorCode: null,
  /** @type {string|null} What the user is told about a failure, when it is not the generic one. */
  message: null,
};

/**
 * The progress of the unlock or the retry the user asked for.
 *
 * @param {Object} state Redux state
 * @returns {{ status: string, errorCode: string|null, message: string|null }}
 */
export function selectShieldedUnlock(state) {
  return state.shielded?.unlock ?? SHIELDED_UNLOCK_INITIAL_STATE;
}

/**
 * Whether an unlock or a retry is running.
 *
 * @param {{ status: string }} unlock The progress, as selectShieldedUnlock returns it
 * @returns {boolean}
 */
export function isShieldedUnlockInProgress(unlock) {
  return unlock.status === SHIELDED_UNLOCK_PROGRESS.UNLOCKING
    || unlock.status === SHIELDED_UNLOCK_PROGRESS.DECODING;
}
