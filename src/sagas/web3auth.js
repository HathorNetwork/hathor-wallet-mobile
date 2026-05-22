/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { put, call } from 'redux-saga/effects';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Web3Auth from '@web3auth/react-native-sdk';
import { CHAIN_NAMESPACES } from '@web3auth/base';
import { CommonPrivateKeyProvider } from '@web3auth/base-provider';
import * as WebBrowser from '@toruslabs/react-native-web-browser';
import EncryptedStorage from 'react-native-encrypted-storage';
import { PrivateKey } from 'bitcore-lib';
import {
  WEB3AUTH_CONFIG,
  WEB3AUTH_REDIRECT_URL,
  WEB3AUTH_WALLET_TYPE_KEY,
  WEB3AUTH_EMAIL_KEY,
} from '../constants';
import { setWalletType, setWeb3authEmail } from '../actions';
import { logger } from '../logger';

const log = logger('web3auth');

let web3authInstance = null;

export const WEB3AUTH_ERROR_TYPES = Object.freeze({
  USER_CANCELLED: 'user_cancelled',
  NETWORK: 'network',
  VERIFIER_CONFIG: 'verifier_config',
  MFA_REQUIRED: 'mfa_required',
  KEY_DERIVATION: 'key_derivation',
  UNKNOWN: 'unknown',
});

/**
 * Classifies a Web3Auth SDK error into a known type so the UI can pick the
 * right dialog copy and the observability layer can tag the event correctly.
 *
 * The SDK does not expose a stable error enum, so we string-match the messages
 * we have seen in practice. Unknown errors fall back to UNKNOWN, which the UI
 * treats like a network error but Sentry tags differently so the team can
 * triage new patterns.
 */
export function classifyWeb3AuthError(err) {
  if (!err) return WEB3AUTH_ERROR_TYPES.UNKNOWN;

  const msg = String(err.message || err).toLowerCase();

  if (msg.includes('user closed') || msg.includes('user_cancelled') || msg.includes('user cancelled')) {
    return WEB3AUTH_ERROR_TYPES.USER_CANCELLED;
  }
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch')) {
    return WEB3AUTH_ERROR_TYPES.NETWORK;
  }
  if (msg.includes('verifier') || msg.includes('jwt') || msg.includes('invalid_token')) {
    return WEB3AUTH_ERROR_TYPES.VERIFIER_CONFIG;
  }
  if (msg.includes('mfa') || msg.includes('factor')) {
    return WEB3AUTH_ERROR_TYPES.MFA_REQUIRED;
  }
  if (msg.includes('invalid') && msg.includes('key')) {
    return WEB3AUTH_ERROR_TYPES.KEY_DERIVATION;
  }
  return WEB3AUTH_ERROR_TYPES.UNKNOWN;
}

/**
 * Returns the Web3Auth config entry matching the current Hathor network.
 *
 * @throws {Error} if the matching entry is incomplete (e.g., mainnet not yet
 *                 configured in the dashboard). The error is intentional —
 *                 it surfaces as a controlled failure to the user instead of
 *                 silently logging into the wrong Web3Auth project.
 */
// eslint-disable-next-line no-unused-vars
function getWeb3AuthConfig(hathorNetwork) {
  // TEMP: force testnet (Sapphire Devnet) Web3Auth config while the mainnet
  // project is not provisioned yet. All development testing runs against
  // devnet — restore the block below once WEB3AUTH_CONFIG.mainnet has
  // clientId/googleClientId filled in.
  return WEB3AUTH_CONFIG.testnet;

  // const cfg = WEB3AUTH_CONFIG[hathorNetwork];
  // if (!cfg) {
  //   throw new Error(`Unknown Hathor network: ${hathorNetwork}`);
  // }
  // if (!cfg.clientId || !cfg.googleClientId) {
  //   throw new Error(
  //     `Web3Auth is not configured for ${hathorNetwork} yet. `
  //     + `Please contact support.`,
  //   );
  // }
  // return cfg;
}

/**
 * Initialize the Web3Auth SDK singleton.
 * All SDK objects are created lazily to avoid top-level crypto operations
 * that conflict with the react-native-crypto polyfill.
 * Must be awaited — calls init() on first use.
 * @returns {Promise<Web3Auth>}
 */
async function getWeb3AuthInstance(hathorNetwork) {
  if (!web3authInstance) {
    console.log('[W3A-DEBUG] Creating Web3Auth instance...');
    const cfg = getWeb3AuthConfig(hathorNetwork);
    const pkProvider = new CommonPrivateKeyProvider({
      config: {
        chainConfig: {
          chainNamespace: CHAIN_NAMESPACES.OTHER,
          chainId: '0x1',
          rpcTarget: 'https://node1.mainnet.hathor.network/v1a/',
          displayName: 'Hathor Network',
          ticker: 'HTR',
          tickerName: 'Hathor',
        },
      },
    });
    console.log('[W3A-DEBUG] CommonPrivateKeyProvider created');

    web3authInstance = new Web3Auth(WebBrowser, EncryptedStorage, {
      clientId: cfg.clientId,
      redirectUrl: WEB3AUTH_REDIRECT_URL,
      network: cfg.network,
      privateKeyProvider: pkProvider,
      loginConfig: {
        google: {
          verifier: cfg.verifier,
          typeOfLogin: 'google',
          clientId: cfg.googleClientId,
        },
      },
    });
    console.log('[W3A-DEBUG] Web3Auth constructor done, calling init()...');
    await web3authInstance.init();
    console.log('[W3A-DEBUG] Web3Auth init() complete');
  }
  return web3authInstance;
}

/**
 * Perform social login via Web3Auth.
 * @param {string} loginProvider - One of LOGIN_PROVIDER.GOOGLE, APPLE, EMAIL_PASSWORDLESS
 * @returns {Promise<{privateKey: string, email: string}>}
 */
export async function web3authLogin(loginProvider, hathorNetwork, extraLoginOptions = {}) {
  const web3auth = await getWeb3AuthInstance(hathorNetwork);
  const provider = await web3auth.login({
    loginProvider,
    curve: 'secp256k1',
    mfaLevel: 'mandatory',
    extraLoginOptions,
  });

  // Get user info from the web3auth instance (v8 API)
  const userInfo = web3auth.userInfo();
  const email = userInfo?.email || userInfo?.name || '';

  // Get raw private key from provider (CommonPrivateKeyProvider)
  const privateKey = await provider.request({ method: 'private_key' });

  // TEMP: print private key to compare custom verifier vs shared verifier.
  // Remove before merging.
  console.log('[W3A-DEBUG] privateKey:', privateKey, 'email:', email);

  return { privateKey, email };
}

/**
 * Derive the compressed public key (hex) from a raw secp256k1 private key.
 *
 * The single-key wallet only needs the public key at construction time;
 * the address is derived inside the wallet-lib using the connection network
 * (see HathorWallet.start in @hathor/wallet-lib), so we don't need to know
 * the network here.
 *
 * @param {string} privateKeyHex - 32-byte hex private key
 * @returns {string} Compressed public key hex
 */
export function derivePublicKey(privateKeyHex) {
  return new PrivateKey(privateKeyHex).toPublicKey().toString();
}

/**
 * Persist walletType and email to AsyncStorage and Redux.
 */
export function* persistWeb3AuthState(walletType, email) {
  // Values are JSON-serialized to remain compatible with STORE.preStart,
  // which iterates AsyncStorage on startup and JSON.parse's every value.
  yield call(() => AsyncStorage.setItem(WEB3AUTH_WALLET_TYPE_KEY, JSON.stringify(walletType)));
  if (email) {
    yield call(() => AsyncStorage.setItem(WEB3AUTH_EMAIL_KEY, JSON.stringify(email)));
  }
  yield put(setWalletType(walletType));
  yield put(setWeb3authEmail(email));
}

/**
 * Restore walletType and email from AsyncStorage into Redux on app start.
 */
export function* restoreWeb3AuthState() {
  const rawWalletType = yield call(() => AsyncStorage.getItem(WEB3AUTH_WALLET_TYPE_KEY));
  const rawEmail = yield call(() => AsyncStorage.getItem(WEB3AUTH_EMAIL_KEY));
  const walletType = rawWalletType ? JSON.parse(rawWalletType) : null;
  const email = rawEmail ? JSON.parse(rawEmail) : null;

  if (walletType) {
    yield put(setWalletType(walletType));
  }
  if (email) {
    yield put(setWeb3authEmail(email));
  }
}

/**
 * Perform Web3Auth logout (clear session).
 */
export async function web3authLogout() {
  try {
    if (web3authInstance) {
      await web3authInstance.logout();
    }
  } catch (e) {
    log.error('Error during web3auth logout:', e);
  }
  web3authInstance = null;
}

/**
 * Clean up Web3Auth state from AsyncStorage.
 */
export function* cleanWeb3AuthState() {
  yield call(() => AsyncStorage.removeItem(WEB3AUTH_WALLET_TYPE_KEY));
  yield call(() => AsyncStorage.removeItem(WEB3AUTH_EMAIL_KEY));
  yield put(setWalletType(null));
  yield put(setWeb3authEmail(null));
}
