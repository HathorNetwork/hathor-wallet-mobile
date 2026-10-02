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
 * tx-signing method is registered — so the passkey action runs directly. Other wallets collect the
 * PIN through the PinScreen, which invokes `pinParams.cb` with the entered PIN.
 *
 * The passkey action defaults to `pinParams.cb` — the common case, where both paths run the same
 * function — so a caller only passes `onPasskey` when it must differ (e.g. wrapping it to flip a
 * sending flag only on the inline passkey path). This keeps the two from silently diverging.
 *
 * @param {object} args
 * @param {{ navigate: Function }} args.navigation - Navigation used to open the PinScreen.
 * @param {object} args.pinParams - Params forwarded to the PinScreen (cb, screenText, ...); cb is
 *   invoked with the entered PIN. Ignored for passkey wallets.
 * @param {() => void} [args.onPasskey] - The passkey-path action, run directly (no PIN) for passkey
 *   wallets. Defaults to `pinParams.cb`; pass it only when the passkey path must differ.
 */
export function authorizeTransaction({ navigation, pinParams, onPasskey = pinParams.cb }) {
  if (STORE.isPasskeyWallet()) {
    onPasskey();
    return;
  }
  navigation.navigate('PinScreen', pinParams);
}
