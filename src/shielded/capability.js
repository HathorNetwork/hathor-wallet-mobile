/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * A capability below 'full', for a wallet-service facade wallet, with the shape
 * getShieldedCapability() gives.
 *
 * @param {string} reason
 * @returns {Object} IShieldedCapability
 */
function noneCapability(reason) {
  return {
    level: 'none',
    reason,
    cause: null,
    canReceive: false,
    canSpend: false,
    historyComplete: false,
    undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
  };
}

/**
 * The shielded capability of a wallet-service facade wallet, which has no
 * getShieldedCapability(). Its scan key is unlocked at start(), which registers the shielded keys
 * with the wallet-service, and the service decodes its shielded outputs, so it is never locked
 * and has nothing left undecoded:
 * - 'none' before the wallet is ready (reason 'not-started');
 * - 'none' when the service didn't register its shielded keys (reason 'no-shielded-keys'), as on a
 *   wallet-service without shielded support;
 * - 'none' without a crypto provider (reason 'no-provider'), which builds its shielded outputs;
 * - 'full' otherwise.
 *
 * @param {HathorWalletServiceWallet} wallet
 * @returns {Object} IShieldedCapability
 */
export function walletServiceShieldedCapability(wallet) {
  if (!wallet.isReady()) {
    return noneCapability('not-started');
  }
  if (typeof wallet.isShieldedEnabled !== 'function' || !wallet.isShieldedEnabled()) {
    return noneCapability('no-shielded-keys');
  }
  if (!wallet.storage?.shieldedCryptoProvider) {
    return noneCapability('no-provider');
  }
  return {
    level: 'full',
    reason: null,
    cause: null,
    canReceive: true,
    canSpend: true,
    historyComplete: true,
    undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
  };
}

/**
 * The wallet's shielded capability: what getShieldedCapability() gives on the fullnode facade, or
 * walletServiceShieldedCapability on the wallet-service facade, which has no such method.
 *
 * @param {HathorWallet|HathorWalletServiceWallet} wallet
 * @returns {Promise<Object>} IShieldedCapability
 */
export async function getWalletShieldedCapability(wallet) {
  if (typeof wallet.getShieldedCapability === 'function') {
    return wallet.getShieldedCapability();
  }
  return walletServiceShieldedCapability(wallet);
}
