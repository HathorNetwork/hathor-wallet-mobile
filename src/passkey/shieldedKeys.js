/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Shielded keys of passkey (PIN-less, xpub-only) wallets.
 *
 * The shielded scan (m/44'/280'/1'/0) and spend (m/44'/280'/2'/0) keys sit on hardened paths off
 * the root, so they can't come from the stored account xpub: they are derived inside a passkey
 * ceremony, while the words are in memory. Their xpubs are public and are kept in the walletMeta
 * (`shieldedXpubs`), so the wallet gets a shielded chain on every start. The scan PRIVATE key,
 * the view key of every shielded output, is never persisted: it is held in memory for the session,
 * as a seed wallet keeps its PIN for restarts (see restartPin in sagas/wallet.js), so a reload or
 * a network change starts the wallet unlocked again without a prompt. A wallet reset drops it.
 *
 * Everything is derived from the mainnet root, like the account xpub (derivePasskeyXpub) and the
 * seed wallet's access data: wallet-lib checks the scan key against the stored scan xpub as
 * serialized, network version bytes included, and the shielded addresses don't depend on it.
 *
 * A wallet-lib without the shielded derivers (deriveShieldedXpubs, deriveShieldedScanXPrivKey)
 * can't start a passkey wallet with shielded keys: then nothing here derives or reports any, and
 * passkey wallets run without shielded support, as before.
 *
 * On the wallet-service facade the service decodes the shielded outputs: it gets the scan key when
 * the wallet registers there (see passkey/walletServiceRegistration.js), and the running wallet
 * gets the scan key held here after its start (setShieldedScanKey), to read the shielded outputs
 * its sends spend.
 */

import { HathorWalletServiceWallet, walletUtils } from '@hathor/wallet-lib';
import { NETWORK_MAINNET } from '../constants';
import { STORE } from '../store';
import { logger } from '../logger';
import { withPasskeyWords } from './passkeySigner';

const log = logger('passkey-shielded');

/**
 * The scan key of the session, and the account xpub of the wallet it was derived for: a key
 * derived for another wallet is never handed out.
 *
 * @type {{ xpub: string, scanXPrivKey: string }|null}
 */
let scanKeyHolder = null;

/**
 * Whether the bundled wallet-lib can derive the shielded keys of a passkey wallet.
 *
 * @returns {boolean}
 */
export function supportsPasskeyShielded() {
  return typeof walletUtils.deriveShieldedXpubs === 'function'
    && typeof walletUtils.deriveShieldedScanXPrivKey === 'function';
}

/**
 * Whether the bundled wallet-lib can also run a passkey wallet with shielded keys on the
 * wallet-service facade: start it read-only with its shielded xpubs, and hand it the scan key.
 *
 * @returns {boolean}
 */
export function supportsPasskeyShieldedWalletService() {
  return supportsPasskeyShielded()
    && typeof HathorWalletServiceWallet.prototype.setShieldedScanKey === 'function';
}

/**
 * Derive the shielded xpubs and the scan private key from the passkey's words.
 *
 * @param {string} words BIP39 seed phrase derived from the passkey PRF secret
 * @returns {{
 *   shieldedXpubs: { scanXpubkey: string, spendXpubkey: string },
 *   scanXPrivKey: string,
 * }|null} null when the bundled wallet-lib can't derive them
 */
export function derivePasskeyShieldedKeys(words) {
  if (!supportsPasskeyShielded()) {
    return null;
  }
  let root = walletUtils.getXPrivKeyFromSeed(words, { networkName: NETWORK_MAINNET });
  try {
    return {
      shieldedXpubs: walletUtils.deriveShieldedXpubs(root),
      scanXPrivKey: walletUtils.deriveShieldedScanXPrivKey(root),
    };
  } finally {
    // JS cannot zero key memory; dropping the reference is the best available hygiene.
    root = null;
  }
}

/**
 * The shielded xpubs stored for the passkey wallet.
 *
 * @param {Object|null} [walletMeta] The wallet metadata, the stored one by default
 * @returns {{ scanXpubkey: string, spendXpubkey: string }|null} null when either is missing, or
 *   when the bundled wallet-lib can't use them
 */
export function getPasskeyShieldedXpubs(walletMeta = STORE.getWalletMeta()) {
  if (!supportsPasskeyShielded()) {
    return null;
  }
  const { scanXpubkey, spendXpubkey } = walletMeta?.shieldedXpubs ?? {};
  if (!scanXpubkey || !spendXpubkey) {
    return null;
  }
  return { scanXpubkey, spendXpubkey };
}

/**
 * Derive the shielded keys inside a passkey ceremony of the loaded wallet, store the xpubs in its
 * walletMeta when they are missing or differ (wallets created before shielded outputs get them on
 * their next unlock), and hold the scan key for the session.
 *
 * It runs inside the unlock ceremony, which must never fail because of it: errors are logged and
 * give null. The walletMeta's memory cache is updated synchronously, so a start requested right
 * after sees the xpubs; the durable write is only logged when it fails.
 *
 * @param {string} words The words of the loaded wallet, already checked against its xpub
 * @returns {string|null} The scan private key, or null when none was derived
 */
export function rememberPasskeyShieldedKeys(words) {
  try {
    const keys = derivePasskeyShieldedKeys(words);
    if (!keys) {
      return null;
    }
    const meta = STORE.getWalletMeta();
    const stored = meta?.shieldedXpubs;
    if (
      stored?.scanXpubkey !== keys.shieldedXpubs.scanXpubkey
      || stored?.spendXpubkey !== keys.shieldedXpubs.spendXpubkey
    ) {
      STORE.updateWalletMeta({ shieldedXpubs: keys.shieldedXpubs })
        .catch((e) => log.error('Failed to store the shielded xpubs.', e));
    }
    holdPasskeyScanKey(keys.scanXPrivKey);
    return keys.scanXPrivKey;
  } catch (e) {
    log.error('Failed to derive the shielded keys of the passkey wallet.', e);
    return null;
  }
}

/**
 * Hold a scan private key for the session, for the loaded wallet (its walletMeta.xpub).
 *
 * @param {string} scanXPrivKey A scan key derived from the loaded wallet's words
 */
export function holdPasskeyScanKey(scanXPrivKey) {
  scanKeyHolder = { xpub: STORE.getWalletMeta()?.xpub, scanXPrivKey };
}

/**
 * The scan private key held for the loaded wallet, or null: none was derived in this session, or
 * it was derived for another wallet.
 *
 * @returns {string|null}
 */
export function getPasskeyScanKey() {
  const xpub = STORE.getWalletMeta()?.xpub;
  if (!scanKeyHolder || !xpub || scanKeyHolder.xpub !== xpub) {
    return null;
  }
  return scanKeyHolder.scanXPrivKey;
}

/** Drop the scan private key held for the session. */
export function clearPasskeyScanKey() {
  scanKeyHolder = null;
}

/**
 * Run a passkey ceremony to derive the shielded keys of the loaded wallet, and hold its scan key
 * (see rememberPasskeyShieldedKeys): the passkey counterpart of the PIN entry that unlocks a seed
 * wallet's private balance.
 *
 * @returns {Promise<string>} The scan private key
 * @throws the ceremony's errors (PasskeyCancelledError, PasskeyXpubMismatchError,
 *   PasskeyBusyError...), and an Error when no key was derived. A wallet-lib that can't derive
 *   them fails before the prompt.
 */
export async function unlockPasskeyShieldedKeys() {
  if (!supportsPasskeyShielded()) {
    throw new Error('This version of the app cannot derive the shielded keys of a passkey wallet.');
  }
  const scanXPrivKey = await withPasskeyWords(async (words) => rememberPasskeyShieldedKeys(words));
  if (!scanXPrivKey) {
    throw new Error('The passkey did not derive the shielded keys.');
  }
  return scanXPrivKey;
}

/**
 * Put the stored shielded xpubs of a passkey wallet on its access data before a fullnode-facade
 * start: wallet-lib builds the shielded chain from the access data, and only creates one when
 * there is none. It runs on every such start, since another start can save the access data
 * without them. A wallet without stored shielded xpubs is left as it is.
 *
 * @param {Object} storage The wallet's storage
 * @param {Object} walletMeta The wallet metadata
 * @returns {Promise<boolean>} Whether the access data was saved
 * @throws when a stored xpub is not an extended public key, or the storage fails
 */
export async function syncPasskeyShieldedAccessData(storage, walletMeta) {
  const xpubs = getPasskeyShieldedXpubs(walletMeta);
  if (!xpubs) {
    return false;
  }
  // Validates the xpubs, and gives the access data a start would create for this wallet.
  const generated = walletUtils.generateAccessDataFromXpub(walletMeta.xpub, xpubs);
  if (!generated.scanXpubkey || !generated.spendXpubkey) {
    return false;
  }
  const accessData = await storage.getAccessData();
  if (
    accessData?.scanXpubkey === generated.scanXpubkey
    && accessData?.spendXpubkey === generated.spendXpubkey
  ) {
    return false;
  }
  await storage.saveAccessData(accessData
    ? {
      ...accessData,
      scanXpubkey: generated.scanXpubkey,
      spendXpubkey: generated.spendXpubkey,
    }
    : generated);
  return true;
}
