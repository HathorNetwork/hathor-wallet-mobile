/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { STORE } from '../store';

/**
 * Authorize a transaction, choosing the mechanism by wallet type. Centralizes the PIN-less passkey
 * contract so its rationale lives in ONE place instead of being duplicated (and drifting) across
 * every confirm screen.
 *
 * Passkey wallets have no PIN: authorization IS the passkey ceremony, fired by the external signer
 * when the lib requests signatures. No PIN is passed — signing is PIN-optional once an external
 * tx-signing method is registered — so `execute` is called directly. Every other wallet collects
 * the PIN through the PinScreen, which invokes `pinParams.cb` (typically the same `execute`) with
 * the entered PIN.
 *
 * @param {object} args
 * @param {() => void} args.execute - The passkey-path action, run directly (no PIN) for passkey
 *   wallets. NOT called for PIN wallets — those authorize through pinParams.cb instead. It is
 *   often the same function as pinParams.cb, but need not be (a caller may wrap it).
 * @param {{ navigate: Function }} args.navigation - Navigation used to open the PinScreen.
 * @param {object} args.pinParams - Params forwarded to the PinScreen (cb, screenText, ...); cb is
 *   invoked with the entered PIN. Ignored for passkey wallets.
 */
export function authorizeTransaction({ execute, navigation, pinParams }) {
  if (STORE.isPasskeyWallet()) {
    execute();
    return;
  }
  navigation.navigate('PinScreen', pinParams);
}
