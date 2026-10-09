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
  /** The wallet was not locked (level other than 'watch'): nothing to unlock. */
  SKIPPED: 'skipped',
  /** The PIN unlocked the scan key; the wallet decodes its locked outputs in a walk. */
  UNLOCKED: 'unlocked',
  /** wallet-lib refused the unlock; errorCode says why. */
  FAILED: 'failed',
};

/**
 * Unlocks the shielded view key of a running wallet that holds its shielded outputs locked
 * (level 'watch'), with the PIN that decrypts its access data now. It returns once the key is
 * unlocked, without waiting for the walk that decodes the locked outputs: `reprocessed`
 * resolves with the capability when that walk ends, and never rejects.
 *
 * A wallet at another level is left as it is. When wallet-lib refuses the unlock, it returns
 * the ShieldedKeyError's code, one of the 'shielded-*' strings (such as 'shielded-wrong-pin' or
 * 'shielded-corrupt-key'). Any other error is thrown.
 *
 * @param {HathorWallet} wallet A started fullnode-facade wallet
 * @param {string} pinCode The wallet's PIN, or its safe-biometry password
 * @returns {Promise<
 *   { status: 'skipped', capability: Object }
 *   | { status: 'unlocked', capability: Object, reprocessed: Promise<Object> }
 *   | { status: 'failed', errorCode: string }
 * >}
 */
export async function unlockShieldedViewIfLocked(wallet, pinCode) {
  const current = await wallet.getShieldedCapability();
  if (current.level !== 'watch') {
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
