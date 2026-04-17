/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Returns true if the current wallet is a Web3Auth single-key wallet.
 * Use this selector everywhere you need to conditionally hide/show UI
 * or branch logic for single-key vs HD wallets.
 *
 * @param {Object} state - Redux state
 * @returns {boolean}
 */
export const isSingleKeyWallet = (state) => state.walletType === 'web3auth';
