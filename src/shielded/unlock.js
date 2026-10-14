/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { errors } from '@hathor/wallet-lib';

/**
 * What unlockShieldedViewIfLocked did.
 */
export const SHIELDED_UNLOCK_STATUS = {
  /**
   * Nothing to unlock: the wallet is not locked (level other than 'watch'), or no PIN can
   * unlock it (cause 'corrupt-key').
   */
  SKIPPED: 'skipped',
  /** The PIN unlocked the scan key; the wallet decodes its locked outputs in a walk. */
  UNLOCKED: 'unlocked',
  /** wallet-lib refused the unlock; errorCode says why. */
  FAILED: 'failed',
};

/**
 * The lock cause of a wallet whose PIN passes the check of its stored scan key, but whose stored
 * key doesn't decrypt to a valid key. No PIN can unlock it: only deriving the shielded keys again
 * repairs the record.
 */
const CORRUPT_KEY_CAUSE = 'corrupt-key';

/**
 * Unlocks the shielded view key of a running wallet that holds its shielded outputs locked
 * (level 'watch'), with the PIN that decrypts its access data now. It returns once the key is
 * unlocked, without waiting for the walk that decodes the locked outputs: `reprocessed`
 * resolves with the capability when that walk ends, and never rejects.
 *
 * A wallet without a shielded capability, such as a wallet-service facade wallet, is skipped with a
 * null capability. A wallet at another level is left as it is, and so is a locked wallet whose
 * cause is 'corrupt-key', which no PIN can unlock: a try would only run the PIN check and the
 * decrypt again, and fail. A PIN can fix the other causes ('not-supplied', 'wrong-pin' and
 * 'error'). When wallet-lib refuses the unlock, it returns the ShieldedKeyError's code, one of the
 * 'shielded-*' strings (such as 'shielded-wrong-pin' or 'shielded-corrupt-key'). Any other error is
 * thrown.
 *
 * @param {HathorWallet|HathorWalletServiceWallet} wallet A started wallet
 * @param {string} pinCode The wallet's PIN, or its safe-biometry password
 * @returns {Promise<
 *   { status: 'skipped', capability: Object|null }
 *   | { status: 'unlocked', capability: Object, reprocessed: Promise<Object> }
 *   | { status: 'failed', errorCode: string }
 * >}
 */
export async function unlockShieldedViewIfLocked(wallet, pinCode) {
  if (typeof wallet.getShieldedCapability !== 'function') {
    return { status: SHIELDED_UNLOCK_STATUS.SKIPPED, capability: null };
  }
  const current = await wallet.getShieldedCapability();
  if (current.level !== 'watch' || current.cause === CORRUPT_KEY_CAUSE) {
    return { status: SHIELDED_UNLOCK_STATUS.SKIPPED, capability: current };
  }

  try {
    const { capability, reprocessed } = await wallet.unlockShieldedView({ pinCode });
    return { status: SHIELDED_UNLOCK_STATUS.UNLOCKED, capability, reprocessed };
  } catch (e) {
    if (e instanceof errors.ShieldedKeyError) {
      return { status: SHIELDED_UNLOCK_STATUS.FAILED, errorCode: e.errorCode };
    }
    throw e;
  }
}
