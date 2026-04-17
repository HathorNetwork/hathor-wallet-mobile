/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { put, call } from 'redux-saga/effects';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Web3Auth, { LOGIN_PROVIDER, OPENLOGIN_NETWORK } from '@web3auth/react-native-sdk';
import * as WebBrowser from '@toruslabs/react-native-web-browser';
import { PrivateKey } from 'bitcore-lib';
import {
  WEB3AUTH_CLIENT_ID,
  WEB3AUTH_REDIRECT_URL,
  WEB3AUTH_WALLET_TYPE_KEY,
  WEB3AUTH_EMAIL_KEY,
} from '../constants';
import { setWalletType, setWeb3authEmail } from '../actions';
import { logger } from '../logger';

const log = logger('web3auth');

let web3authInstance = null;

/**
 * Initialize the Web3Auth SDK singleton.
 * @returns {Web3Auth}
 */
function getWeb3AuthInstance() {
  if (!web3authInstance) {
    web3authInstance = new Web3Auth(WebBrowser, {
      clientId: WEB3AUTH_CLIENT_ID,
      network: OPENLOGIN_NETWORK.SAPPHIRE_MAINNET,
    });
  }
  return web3authInstance;
}

/**
 * Perform social login via Web3Auth.
 * @param {string} loginProvider - One of LOGIN_PROVIDER.GOOGLE, APPLE, EMAIL_PASSWORDLESS
 * @returns {Promise<{privateKey: string, email: string}>}
 */
export async function web3authLogin(loginProvider) {
  const web3auth = getWeb3AuthInstance();
  const result = await web3auth.login({
    loginProvider,
    redirectUrl: WEB3AUTH_REDIRECT_URL,
    curve: 'secp256k1',
    mfaLevel: 'mandatory',
  });

  const privateKey = result.privKey;
  const email = result.userInfo?.email || result.userInfo?.name || '';

  return { privateKey, email };
}

/**
 * Derive publicKey and address from a raw secp256k1 private key hex.
 * Uses bitcore-lib which is already a dependency of hathor-wallet-lib.
 * @param {string} privateKeyHex - 32-byte hex private key
 * @returns {{ publicKey: string, address: string }}
 */
export function deriveKeysFromPrivateKey(privateKeyHex) {
  const privKey = new PrivateKey(privateKeyHex);
  const pubKey = privKey.toPublicKey();
  const address = pubKey.toAddress().toString();

  return {
    publicKey: pubKey.toString(),
    address,
  };
}

/**
 * Persist walletType and email to AsyncStorage and Redux.
 */
export function* persistWeb3AuthState(walletType, email) {
  yield call(() => AsyncStorage.setItem(WEB3AUTH_WALLET_TYPE_KEY, walletType));
  if (email) {
    yield call(() => AsyncStorage.setItem(WEB3AUTH_EMAIL_KEY, email));
  }
  yield put(setWalletType(walletType));
  yield put(setWeb3authEmail(email));
}

/**
 * Restore walletType and email from AsyncStorage into Redux on app start.
 */
export function* restoreWeb3AuthState() {
  const walletType = yield call(() => AsyncStorage.getItem(WEB3AUTH_WALLET_TYPE_KEY));
  const email = yield call(() => AsyncStorage.getItem(WEB3AUTH_EMAIL_KEY));

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
    const web3auth = getWeb3AuthInstance();
    await web3auth.logout();
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
