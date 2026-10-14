/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { t } from 'ttag';
import { ErrorMessages, errors } from '@hathor/wallet-lib';

const { SHIELDED_LOCKED, SHIELDED_NO_PROVIDER } = ErrorMessages.ErrorMessages;

/**
 * Why the wallet couldn't give its new (shielded) address, for the user, or null for an error
 * that isn't wallet-lib's refusal of it. In the shielded environment the new address is the
 * wallet's address, and no legacy address stands in for it:
 * - 'shielded-locked': the scan key isn't unlocked, and getCurrentAddress gives out no new
 *   address until it is. The user can unlock the private balance, then try again;
 * - 'shielded-no-provider': no crypto provider is registered, as when it failed its self-test;
 * - any other ShieldedKeyError: this wallet has no shielded chain it can use.
 *
 * @param {unknown} error The error wallet.getCurrentAddress or wallet.getAddressAtIndex threw for
 *   a new address
 * @returns {string|null}
 */
export function newAddressErrorText(error) {
  if (!(error instanceof errors.ShieldedKeyError)) {
    return null;
  }
  switch (error.errorCode) {
    case SHIELDED_LOCKED:
      return t`Your private balance is locked. Unlock it and try again.`;
    case SHIELDED_NO_PROVIDER:
      return t`Private transfers could not be loaded on this device.`;
    default:
      return t`Private transfers are not available for this wallet.`;
  }
}
