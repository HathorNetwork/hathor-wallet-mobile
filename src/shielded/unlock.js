/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { errors } from '@hathor/wallet-lib';
import { getWalletShieldedCapability } from './capability';
import { isUnlockableLock } from './gating';

/**
 * What unlockShieldedViewIfLocked did.
 */
export const SHIELDED_UNLOCK_STATUS = {
  /**
   * Nothing to unlock: the wallet is not locked (level other than 'watch'), or no unlock can fix
   * its lock (see isUnlockableLock).
   */
  SKIPPED: 'skipped',
  /** The scan key is unlocked; the wallet decodes its locked outputs in a walk. */
  UNLOCKED: 'unlocked',
  /** wallet-lib refused the unlock; errorCode says why. */
  FAILED: 'failed',
};

/**
 * Unlocks the shielded view key of a running wallet that holds its shielded outputs locked
 * (level 'watch'): a seed wallet with the PIN that decrypts its access data now, a passkey wallet
 * with the scan key a passkey ceremony derived. It returns once the key is unlocked, without
 * waiting for the walk that decodes the locked outputs: `reprocessed` resolves with the capability
 * when that walk ends, and never rejects.
 *
 * A wallet that has no view key to unlock, such as a wallet-service facade wallet, whose scan key
 * is unlocked at start(), is skipped with its capability (getWalletShieldedCapability). A wallet
 * at another level is left as it is, and so is a locked wallet whose lock no unlock can fix (cause
 * 'corrupt-key' or 'key-mismatch', see isUnlockableLock): a try would only check the key again,
 * and fail. An unlock can fix the other causes ('not-supplied', 'wrong-pin' and 'error'). When
 * wallet-lib refuses the unlock, it returns the ShieldedKeyError's code, one of the 'shielded-*'
 * strings (such as 'shielded-wrong-pin' or 'shielded-corrupt-key'). Any other error is thrown.
 *
 * @param {HathorWallet|HathorWalletServiceWallet} wallet A started wallet
 * @param {{ pinCode: string }|{ scanXPrivKey: string }} input wallet-lib's ShieldedViewKeyInput:
 *   the wallet's PIN, or its safe-biometry password; or the scan private key itself
 * @returns {Promise<
 *   { status: 'skipped', capability: Object|null }
 *   | { status: 'unlocked', capability: Object, reprocessed: Promise<Object> }
 *   | { status: 'failed', errorCode: string }
 * >}
 */
export async function unlockShieldedViewIfLocked(wallet, input) {
  const current = await getWalletShieldedCapability(wallet);
  if (typeof wallet.unlockShieldedView !== 'function' || !isUnlockableLock(current)) {
    return { status: SHIELDED_UNLOCK_STATUS.SKIPPED, capability: current };
  }

  try {
    const { capability, reprocessed } = await wallet.unlockShieldedView(input);
    return { status: SHIELDED_UNLOCK_STATUS.UNLOCKED, capability, reprocessed };
  } catch (e) {
    if (e instanceof errors.ShieldedKeyError) {
      return { status: SHIELDED_UNLOCK_STATUS.FAILED, errorCode: e.errorCode };
    }
    throw e;
  }
}
