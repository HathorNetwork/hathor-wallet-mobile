/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Wallet-service registration for passkey wallets.
 *
 * A passkey wallet can run on the wallet-service facade once the wallet exists there. Creating it
 * (`wallet/init`) needs signatures from the account key and the auth key, so it needs the seed
 * words once: it runs inside a passkey ceremony (onboarding, unlock or a push-settings save),
 * through a temporary in-memory wallet-service wallet that is stopped right after.
 *
 * Afterwards the app starts the passkey wallet on the facade from its xpub (`startReadOnly`,
 * read-only token for browsing). Full tokens are minted inside the signing ceremony from the auth
 * key, which is never stored. The only thing persisted here is non-secret: which wallet-service
 * URLs already know this wallet (`walletMeta.walletServiceRegistrations`), so the app never starts
 * on the facade for an unregistered wallet (`startReadOnly` would poll for a minute, then fail).
 */

import { get } from 'lodash';
import { HathorWalletServiceWallet, Network, config } from '@hathor/wallet-lib';
import { STORE } from '../store';
import { WALLET_SERVICE_FEATURE_TOGGLE } from '../constants';
import { logger } from '../logger';

const log = logger('passkey-wallet-service');

/**
 * Build and start a temporary, in-memory wallet-service wallet from seed words. Starting it signs
 * in with a full auth token and creates the wallet in the wallet-service (`wallet/init`) if it
 * doesn't exist yet. The caller must stop it when done.
 *
 * @param {string} seed 24 seed words
 * @param {Network} network
 * @param {string} pin Encrypts the temp wallet's in-memory access data (never persisted)
 * @returns {Promise<HathorWalletServiceWallet>}
 */
export async function startTempWalletServiceWallet(seed, network, pin) {
  const wallet = new HathorWalletServiceWallet({ seed, network, enableWs: false });
  await wallet.start({ pinCode: pin, password: pin });
  return wallet;
}

/**
 * A random one-time pin for a temporary wallet: it only encrypts in-memory access data that is
 * dropped when the temp wallet stops, so it never needs to be known again.
 */
export function makeEphemeralPin() {
  return Buffer.from(global.crypto.getRandomValues(new Uint8Array(32))).toString('hex');
}

/**
 * Whether the bundled wallet-lib can run an xpub-only wallet on the wallet-service facade with an
 * external signer. False on wallet-lib 3.1.1, which keeps this whole feature inert until the bump.
 */
export function facadeSupportsExternalSigner() {
  const proto = HathorWalletServiceWallet.prototype;
  return typeof proto.setExternalTxSigningMethod === 'function'
    && typeof proto.refreshFullAuthToken === 'function'
    && typeof proto.startReadOnly === 'function';
}

/** Whether the wallet-service at `walletServiceUrl` already knows this passkey wallet. */
export function isWalletServiceRegistered(walletServiceUrl) {
  const registrations = STORE.getWalletMeta()?.walletServiceRegistrations ?? [];
  return !!walletServiceUrl && registrations.includes(walletServiceUrl);
}

/**
 * Record (or forget) that the wallet-service at `walletServiceUrl` knows this wallet. Best-effort:
 * a failed write only means the app registers again later.
 */
export function markWalletServiceRegistered(walletServiceUrl, registered = true) {
  const registrations = STORE.getWalletMeta()?.walletServiceRegistrations ?? [];
  const next = registered
    ? Array.from(new Set([...registrations, walletServiceUrl]))
    : registrations.filter((url) => url !== walletServiceUrl);
  return STORE.updateWalletMeta({ walletServiceRegistrations: next })
    .catch((e) => log.error('Failed to update the wallet-service registration flag', e));
}

/**
 * Whether a passkey wallet should register on the wallet-service now: the wallet-service flag is
 * on, there is a wallet-service URL, the bundled lib supports the facade, and it isn't registered.
 *
 * @param {Object} featureToggles `state.featureToggles`
 * @param {Object} networkSettings `state.networkSettings`
 */
export function shouldRegisterOnWalletService(featureToggles, networkSettings) {
  return get(featureToggles, WALLET_SERVICE_FEATURE_TOGGLE, false)
    && !!networkSettings?.walletServiceUrl
    && facadeSupportsExternalSigner()
    && !isWalletServiceRegistered(networkSettings.walletServiceUrl);
}

/**
 * Create the passkey wallet on the wallet-service (`wallet/init`) from the ceremony's words, then
 * record it. Must run while the words are in memory (inside a passkey ceremony or onboarding).
 *
 * @param {string} words 24 seed words derived from the passkey
 * @param {Object} networkSettings `state.networkSettings`
 */
export async function registerOnWalletService(words, networkSettings) {
  config.setWalletServiceBaseUrl(networkSettings.walletServiceUrl);
  config.setWalletServiceBaseWsUrl(networkSettings.walletServiceWsUrl);
  const tempWallet = await startTempWalletServiceWallet(
    words,
    new Network(networkSettings.network),
    makeEphemeralPin(),
  );
  try {
    await markWalletServiceRegistered(networkSettings.walletServiceUrl);
  } finally {
    // Drop the temp wallet's in-memory access data (encrypted keys) and connection.
    await tempWallet.stop({ cleanStorage: true });
  }
}
