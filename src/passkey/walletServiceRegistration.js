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
import {
  HathorWalletServiceWallet,
  Network,
  config,
  errors as hathorErrors,
} from '@hathor/wallet-lib';
import { STORE } from '../store';
import { isShieldedNetwork } from '../shielded/gating';
import { loadShieldedCryptoProvider } from '../shielded/cryptoProvider';
import { rememberPasskeyShieldedKeys, supportsPasskeyShieldedWalletService } from './shieldedKeys';
import { isExpectedPasskeyError, PasskeyCancelledError, withPasskeyWords } from './passkeySigner';
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

/**
 * The `onRootKey` hook for a passkey ceremony on `wallet`: on the wallet-service facade it derives
 * the auth key from the ceremony's root key and mints a full auth token, so the operation that
 * follows can call full-token endpoints and the auth key is never stored. Undefined for wallets
 * that don't use auth tokens (the fullnode facade).
 *
 * @param {Object} wallet The app's wallet
 * @returns {((root: Object) => Promise<void>)|undefined}
 */
export function passkeyFullTokenHook(wallet) {
  if (typeof wallet?.refreshFullAuthToken !== 'function') {
    return undefined;
  }
  return (root) => wallet.refreshFullAuthToken(
    HathorWalletServiceWallet.deriveAuthPrivateKey(root),
  );
}

/**
 * Whether a failure to start the passkey wallet on the wallet-service facade means the service no
 * longer knows (or won't serve) the wallet, so its registration should be forgotten and redone at
 * the next unlock. Only the service saying so counts:
 * - startReadOnly's "startup timed out": the service kept answering that the wallet isn't ready
 *   (a WalletRequestError whose cause carries the last response as `source`);
 * - a 4xx answer (a WalletRequestError whose cause carries the HTTP `status`).
 * Network failures, timeouts, 5xx answers and anything else are transient: keep the registration
 * (the IGNORE_WS_TOGGLE_FLAG fallback already handles them), so a short outage doesn't cost a new
 * registration at the next unlock.
 *
 * @param {unknown} error What the facade start threw
 * @returns {boolean}
 */
export function startFailureMeansUnregistered(error) {
  if (!(error instanceof hathorErrors.WalletRequestError)) {
    return false;
  }
  const cause = error.cause ?? {};
  if (typeof cause.status === 'number') {
    return cause.status >= 400 && cause.status < 500;
  }
  return cause.source instanceof hathorErrors.WalletRequestError;
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
 * On the shielded testnet, only when the bundled lib can also run a passkey wallet with shielded
 * keys on the facade (supportsPasskeyShieldedWalletService): registering from the words hands the
 * passkey seed's scan key to the wallet-service, which then counts private funds that the app
 * could otherwise neither show nor spend.
 *
 * @param {Object} featureToggles `state.featureToggles`
 * @param {Object} networkSettings `state.networkSettings`
 */
export function shouldRegisterOnWalletService(featureToggles, networkSettings) {
  return get(featureToggles, WALLET_SERVICE_FEATURE_TOGGLE, false)
    && !!networkSettings?.walletServiceUrl
    && (!isShieldedNetwork(networkSettings) || supportsPasskeyShieldedWalletService())
    && facadeSupportsExternalSigner()
    && !isWalletServiceRegistered(networkSettings.walletServiceUrl);
}

/**
 * First half of a registration: build the temporary wallet-service wallet from the words, without
 * starting it. Building only needs the words, so it can run inside a passkey ceremony; starting it
 * talks to the wallet-service and can poll for up to a minute on a first registration, so it runs
 * after the ceremony (completeWalletServiceRegistration) and never holds the passkey lock. The
 * words don't live any longer this way: the wallet keeps the seed until start() clears it.
 *
 * @param {string} words 24 seed words derived from the passkey
 * @param {Object} networkSettings `state.networkSettings`
 * @returns {{
 *   tempWallet: HathorWalletServiceWallet,
 *   walletServiceUrl: string,
 *   shieldedNetwork: boolean,
 * }}
 */
export function prepareWalletServiceRegistration(words, networkSettings) {
  config.setWalletServiceBaseUrl(networkSettings.walletServiceUrl);
  config.setWalletServiceBaseWsUrl(networkSettings.walletServiceWsUrl);
  const tempWallet = new HathorWalletServiceWallet({
    seed: words,
    network: new Network(networkSettings.network),
    enableWs: false,
  });
  return {
    tempWallet,
    walletServiceUrl: networkSettings.walletServiceUrl,
    shieldedNetwork: isShieldedNetwork(networkSettings),
  };
}

/**
 * Second half of a registration: start the prepared temp wallet, which creates the passkey wallet
 * on the wallet-service (`wallet/init`), record it, and stop the temp wallet.
 *
 * On the shielded testnet the start also registers the shielded keys, when the wallet-service
 * supports them. As for a seed wallet, it never does without a working shielded crypto provider:
 * the service would count private funds the app can't spend. Then nothing is registered, and the
 * wallet stays on the fullnode facade. Nor is anything recorded when the start registered no
 * shielded keys: a seed wallet sends them again at each start, but a passkey wallet only registers
 * here, so it tries again at the next unlock instead of starting on a facade without them.
 *
 * @param {{
 *   tempWallet: HathorWalletServiceWallet,
 *   walletServiceUrl: string,
 *   shieldedNetwork?: boolean,
 * }} registration
 */
export async function completeWalletServiceRegistration({
  tempWallet,
  walletServiceUrl,
  shieldedNetwork = false,
}) {
  const pin = makeEphemeralPin();
  try {
    if (shieldedNetwork) {
      const { error } = await loadShieldedCryptoProvider();
      if (error) {
        throw new Error(`No shielded crypto provider to register the wallet with: ${error.message ?? error}`);
      }
    }
    await tempWallet.start({ pinCode: pin, password: pin });
  } catch (e) {
    // Drop the seed now instead of waiting for the wallet to be garbage-collected.
    tempWallet.clearSensitiveData();
    throw e;
  }
  try {
    if (shieldedNetwork && tempWallet.isShieldedEnabled?.() !== true) {
      log.warn('The wallet-service did not register the shielded keys of the passkey wallet; it registers again at the next unlock.');
      return;
    }
    await markWalletServiceRegistered(walletServiceUrl);
  } finally {
    // Close the temp wallet's connection and clear its in-memory history, utxos and tokens. Its
    // encrypted access data stays until the object is garbage-collected.
    await tempWallet.stop({ cleanStorage: true });
  }
}

/**
 * Create the passkey wallet on the wallet-service (`wallet/init`) from the words, then record it.
 * For onboarding, which holds the words outside any passkey ceremony and waits for the result so
 * the new wallet can start on the wallet-service facade right away.
 *
 * @param {string} words 24 seed words derived from the passkey
 * @param {Object} networkSettings `state.networkSettings`
 */
export async function registerOnWalletService(words, networkSettings) {
  return completeWalletServiceRegistration(
    prepareWalletServiceRegistration(words, networkSettings),
  );
}

/**
 * The unlock ceremony's `onWords` hook when this wallet should register on the wallet-service, or
 * undefined. It only prepares the registration (see prepareWalletServiceRegistration) and never
 * throws: a failed registration must never block unlocking.
 *
 * @param {Object} featureToggles `state.featureToggles`
 * @param {Object} networkSettings `state.networkSettings`
 * @returns {((words: string) => Object|null)|undefined}
 */
export function walletServiceRegistrationForUnlock(featureToggles, networkSettings) {
  if (!shouldRegisterOnWalletService(featureToggles, networkSettings)) {
    return undefined;
  }
  return (words) => {
    try {
      return prepareWalletServiceRegistration(words, networkSettings);
    } catch (e) {
      log.error('Passkey wallet-service registration failed at unlock', e);
      return null;
    }
  };
}

/**
 * Finish a registration prepared during the unlock ceremony, in the background: the unlock never
 * waits for the wallet-service. The wallet runs on the wallet-service facade from its next start.
 * Failures are only logged; the next unlock retries.
 *
 * @param {Object|null|undefined} registration What the unlock ceremony's hook returned
 */
export function finishWalletServiceRegistration(registration) {
  if (!registration) {
    return;
  }
  completeWalletServiceRegistration(registration)
    .catch((e) => log.error('Passkey wallet-service registration failed at unlock', e));
}

/**
 * How long a network change waits for the registration: creating the wallet on a wallet-service can
 * take up to a minute, and the network change shows a spinner while it waits.
 */
export const NETWORK_CHANGE_REGISTRATION_WAIT_MS = 15000;

/**
 * Register the passkey wallet on the wallet-service of the network it is switching to, before the
 * wallet starts there, so that start already runs on the wallet-service facade. Without it a
 * network change starts the wallet on the fullnode facade, and only the next unlock registers it.
 *
 * It runs one passkey ceremony, as an unlock does, only when the wallet should register on that
 * wallet-service (shouldRegisterOnWalletService). The ceremony also derives the shielded keys
 * again, as the unlock does. It waits for the registration up to waitMs; a registration still
 * running then finishes in the background, and the wallet runs on the wallet-service facade from
 * its next start.
 * It never throws: when the user cancels the ceremony or the registration fails, the wallet starts
 * on the fullnode facade, and the next unlock registers it.
 *
 * @param {Object} featureToggles `state.featureToggles`, read for the network switched to
 * @param {Object} networkSettings The network settings switched to
 * @param {number} [waitMs] How long to wait for the registration after the ceremony
 * @returns {Promise<boolean>} Whether the wallet-service of that network knows the wallet now
 */
export async function registerOnNetworkChange(
  featureToggles,
  networkSettings,
  waitMs = NETWORK_CHANGE_REGISTRATION_WAIT_MS,
) {
  if (!shouldRegisterOnWalletService(featureToggles, networkSettings)) {
    return isWalletServiceRegistered(networkSettings?.walletServiceUrl);
  }
  let timer;
  try {
    const registration = await withPasskeyWords(async (words) => {
      rememberPasskeyShieldedKeys(words);
      return prepareWalletServiceRegistration(words, networkSettings);
    });
    // After the ceremony, as at unlock: it never holds the passkey lock while the wallet-service
    // creates the wallet.
    const completion = completeWalletServiceRegistration(registration);
    const finished = await Promise.race([
      completion.then(() => true),
      new Promise((resolve) => { timer = setTimeout(() => resolve(false), waitMs); }),
    ]);
    if (!finished) {
      log.warn('The passkey wallet-service registration is still running; the wallet starts on the '
        + 'fullnode facade.');
      completion.catch((e) => log.error('Passkey wallet-service registration failed at network change', e));
    }
  } catch (e) {
    if (e instanceof PasskeyCancelledError || isExpectedPasskeyError(e)) {
      log.log('Passkey wallet-service registration skipped at network change:', e.message);
    } else {
      log.error('Passkey wallet-service registration failed at network change', e);
    }
  } finally {
    clearTimeout(timer);
  }
  return isWalletServiceRegistered(networkSettings.walletServiceUrl);
}
